// End-to-end load test: a scripted host and N bot players play a whole game
// against the Supabase project in .env.local, the way the real pages do, and
// every step is checked.
//
//   node scripts/load-test.mjs [players]        (default 10)
//
// The host needs an account. Set LOADTEST_USERNAME and LOADTEST_PASSWORD, or
// leave them unset and a new loadtest_xxxxxx account is signed up and its
// login printed. The test quiz is deleted at the end, which also deletes the
// game, its players and their answers.
//
// The host voids question VOID_QUESTION ("Don't count"), to check that its
// points are taken back everywhere and that streaks carry on past it.
//
// Each bot opens its own Realtime connection, so keep players + other open
// screens under the plan's connection limit (200 on the free plan).
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const PLAYERS = Number(process.argv[2] ?? 10);
const JOINS_PER_SECOND = 10; // the free plan allows 100 channel joins per second
const AVATAR_STYLES = ['fun-emoji', 'personas', 'big-smile', 'bottts'];
const VOID_QUESTION = 3; // question number the host voids; 0 for none

const QUIZ = [
    { text: 'Which planet is known as the Red Planet?', answers: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1 },
    { text: 'Is the sun a star?', answers: ['Yes', 'No'], correct: 0 },
    { text: 'What is 7 × 8?', answers: ['54', '56', '64'], correct: 1, points: 2000 },
    { text: 'Which ocean is the largest?', answers: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3 },
    { text: 'How many legs does a spider have?', answers: ['6', '8', '10', '12'], correct: 1 },
].map((q, i) => ({
    questionText: q.text,
    timeLimit: 10,
    points: q.points ?? 1000,
    order: i,
    answers: q.answers.map((answerText, j) => ({ answerText, isCorrect: j === q.correct, order: j })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const started = performance.now();
const elapsed = () => `${((performance.now() - started) / 1000).toFixed(1).padStart(5)}s`;
const log = (message) => console.log(`${elapsed()}  ${message}`);

const failures = [];
const warnings = [];
const fail = (who, message) => {
    failures.push(`${who}: ${message}`);
    log(`✗ ${who}: ${message}`);
};
const expect = (ok, who, message) => {
    if (!ok) fail(who, message);
    return ok;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

// Polls until check() is true or the time runs out; returns whether it became true.
async function waitUntil(check, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (!check()) {
        if (Date.now() >= end) return false;
        await sleep(50);
    }
    return true;
}

let shuttingDown = false;

const newClient = () =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

// How long each database function takes, for the report.
const timings = new Map();

async function rpc(client, fn, args) {
    const start = performance.now();
    const { data, error } = await client.rpc(fn, args);
    if (!timings.has(fn)) timings.set(fn, []);
    timings.get(fn).push(performance.now() - start);
    if (error) {
        const failed = new Error(error.message);
        failed.code = error.code;
        throw failed;
    }
    return data;
}

// Same as subscribe() in src/services/gameService.ts: resolves once the
// private channel is joined. Drops after that are recorded as warnings.
async function subscribe(client, who, topic, handlers) {
    await client.realtime.setAuth();
    const channel = client.channel(topic, { config: { private: true } });
    for (const [event, handler] of Object.entries(handlers)) {
        channel.on('broadcast', { event }, ({ payload }) => handler(payload));
    }
    await new Promise((resolve, reject) => {
        let joined = false;
        channel.subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                if (joined) warnings.push(`${who}: reconnected to ${topic}`);
                joined = true;
                resolve();
            } else if (!joined) {
                reject(err ?? new Error(`could not join ${topic} (${status})`));
            } else if (!shuttingDown) {
                warnings.push(`${who}: ${topic} ${status}${err ? ` (${err.message})` : ''}`);
            }
        });
    });
    return channel;
}

// Same as questionTimes() in src/services/gameService.ts.
function questionTimes(payload) {
    const opensAt = Date.now() + Date.parse(payload.startedAt) - Date.parse(payload.serverNow);
    return { opensAt, deadline: opensAt + payload.question.timeLimit * 1000 };
}

// ---------------------------------------------------------------------------
// Bot player
// ---------------------------------------------------------------------------

class Bot {
    constructor(index) {
        this.index = index;
        this.name = `Bot${String(index + 1).padStart(3, '0')}`;
        this.client = newClient();
        this.token = null;
        this.avatar = `${AVATAR_STYLES[index % AVATAR_STYLES.length]}:${this.name}`;
        this.ready = false;
        this.questionsSeen = new Set();
        this.questionOrder = []; // question ids in the order they were shown
        this.answers = new Map(); // question id -> answer id
        this.results = new Map(); // question id -> PlayerResult (fetched again if voided)
        this.currentQuestionId = null;
        this.finished = false;
    }

    get totalPoints() {
        return [...this.results.values()].reduce((sum, r) => sum + r.pointsEarned, 0);
    }

    // Questions that still count, in order.
    get counted() {
        return this.questionOrder.filter((id) => this.results.has(id) && !this.results.get(id).voided);
    }

    async join(pin) {
        const joined = await rpc(this.client, 'join_game', { p_pin: pin, p_name: this.name });
        this.token = joined.playerToken;
        expect(joined.playerName === this.name, this.name, `joined as "${joined.playerName}"`);
        expect(/^[a-z-]+:[A-Za-z0-9]+$/.test(joined.avatar), this.name, `starting avatar "${joined.avatar}" is not a DiceBear one`);

        // The picker's "Let's go!" button.
        await rpc(this.client, 'set_avatar', { p_player_token: this.token, p_avatar: this.avatar });

        await subscribe(this.client, this.name, `game:${joined.sessionId}`, {
            question: (payload) => this.onQuestion(payload),
            questionEnded: () => setTimeout(() => void this.fetchResult(), Math.random() * 400),
            questionVoided: () => setTimeout(() => void this.fetchResult(), Math.random() * 400),
            gameFinished: () => setTimeout(() => void this.fetchFinal(), Math.random() * 400),
            playerKicked: (payload) => {
                if (payload.playerName === this.name) fail(this.name, 'was kicked');
            },
        });

        const state = await rpc(this.client, 'get_player_state', { p_player_token: this.token });
        expect(state.phase === 'lobby', this.name, `phase after joining is ${state.phase}, expected lobby`);
        expect(state.avatar === this.avatar, this.name, `avatar is ${state.avatar} after set_avatar(${this.avatar})`);
        this.ready = true;
    }

    onQuestion(payload) {
        const question = payload.question;
        this.currentQuestionId = question.id;
        if (!this.questionsSeen.has(question.id)) this.questionOrder.push(question.id);
        this.questionsSeen.add(question.id);
        for (const answer of question.answers) {
            if ('isCorrect' in answer || 'is_correct' in answer) {
                fail(this.name, `question ${payload.questionNumber} payload reveals the correct answer`);
                break;
            }
        }

        const { opensAt } = questionTimes(payload);
        const answer = question.answers[Math.floor(Math.random() * question.answers.length)];
        // Real players take a moment; answer somewhere in the first 60% of the time.
        const delay = opensAt - Date.now() + 300 + Math.random() * question.timeLimit * 600;

        // The first bot also checks that answering during the intro is refused.
        if (this.index === 0) {
            rpc(this.client, 'submit_answer', { p_player_token: this.token, p_answer_id: answer.id }).then(
                () => fail(this.name, `answer during the intro of question ${payload.questionNumber} was accepted`),
                (error) => expect(/not open yet/i.test(error.message), this.name, `early answer: ${error.message}`),
            );
        }

        setTimeout(() => void this.submit(payload, answer.id), delay);
    }

    async submit(payload, answerId) {
        const questionId = payload.question.id;
        const who = `${this.name} Q${payload.questionNumber}`;
        try {
            const result = await rpc(this.client, 'submit_answer', { p_player_token: this.token, p_answer_id: answerId });
            if (!expect(result?.accepted === true, who, `submit_answer returned ${JSON.stringify(result)}`)) return;
            this.answers.set(questionId, answerId);
        } catch (error) {
            fail(who, `submit_answer failed: ${error.message}`);
            return;
        }

        // The first bot also checks that a second answer is refused. If it was the
        // last to answer, the host may already have closed the question.
        if (this.index === 0) {
            try {
                await rpc(this.client, 'submit_answer', { p_player_token: this.token, p_answer_id: answerId });
                fail(who, 'a second answer to the same question was accepted');
            } catch (error) {
                expect(/already answered|time is up|no longer open/i.test(error.message), who, `second answer: ${error.message}`);
            }
        }
    }

    async fetchResult() {
        const questionId = this.currentQuestionId;
        const who = `${this.name} result`;
        try {
            const state = await rpc(this.client, 'get_player_state', { p_player_token: this.token });
            if (!expect(state.phase === 'results', who, `phase is ${state.phase}, expected results`)) return;
            const r = state.result;
            if (!expect(!!r, who, 'no result')) return;

            expect(r.answered === this.answers.has(questionId), who, `answered=${r.answered} but the bot ${this.answers.has(questionId) ? 'did' : 'did not'} answer`);
            const parts = r.basePoints + r.speedBonus + r.streakBonus + r.firstBonus;
            expect(parts === r.pointsEarned, who, `bonuses add up to ${parts}, pointsEarned is ${r.pointsEarned}`);
            if (r.voided) {
                expect(r.pointsEarned === 0 && r.streak === 0, who, `voided question still gave ${r.pointsEarned} points, streak ${r.streak}`);
            } else {
                expect(r.isCorrect ? r.pointsEarned > 0 : r.pointsEarned === 0, who, `isCorrect=${r.isCorrect} with ${r.pointsEarned} points`);
                // Streaks skip voided questions.
                const previous = this.results.get(this.counted.filter((id) => id !== questionId).at(-1));
                const expected = r.isCorrect ? (previous?.isCorrect ? previous.streak : 0) + 1 : 0;
                expect(r.streak === expected, who, `streak ${r.streak}, expected ${expected}`);
            }
            expect(r.correctAnswers.length > 0, who, 'no correct answers shown');

            this.results.set(questionId, r);
            expect(state.standing?.totalPoints === this.totalPoints, who, `total is ${state.standing?.totalPoints}, the bot counted ${this.totalPoints}`);
        } catch (error) {
            fail(who, `get_player_state failed: ${error.message}`);
        }
    }

    async fetchFinal() {
        const who = `${this.name} final`;
        try {
            const state = await rpc(this.client, 'get_player_state', { p_player_token: this.token });
            if (!expect(state.phase === 'finished', who, `phase is ${state.phase}, expected finished`)) return;
            const s = state.summary;
            const counted = this.counted;
            const answered = counted.filter((id) => this.answers.has(id)).length;
            const correct = counted.filter((id) => this.results.get(id).isCorrect).length;
            expect(s?.totalQuestions === QUIZ.length - (VOID_QUESTION ? 1 : 0), who, `summary has ${s?.totalQuestions} questions`);
            expect(s?.answeredCount === answered, who, `summary says ${s?.answeredCount} answered, the bot answered ${answered} that count`);
            expect(s?.correctCount === correct, who, `summary says ${s?.correctCount} correct, results said ${correct}`);
            expect(state.standing?.totalPoints === this.totalPoints, who, `final total ${state.standing?.totalPoints}, the bot counted ${this.totalPoints}`);
            this.finished = true;
        } catch (error) {
            fail(who, `get_player_state failed: ${error.message}`);
        }
    }
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------

async function signInHost(client) {
    let username = process.env.LOADTEST_USERNAME;
    let password = process.env.LOADTEST_PASSWORD;
    const email = (name) => `${name.toLowerCase()}@users.quiz.invalid`; // as in src/services/authService.ts

    if (username && password) {
        const { error } = await client.auth.signInWithPassword({ email: email(username), password });
        if (error) throw new Error(`host login failed: ${error.message}`);
        return username;
    }

    username = `loadtest_${randomBytes(3).toString('hex')}`;
    password = randomBytes(12).toString('base64url');
    const { data, error } = await client.auth.signUp({ email: email(username), password, options: { data: { username } } });
    if (error) throw new Error(`host sign-up failed: ${error.message}`);
    if (!data.session) throw new Error('host sign-up gave no session; is "Confirm email" off?');
    log(`Signed up host account. Reuse it with: LOADTEST_USERNAME=${username} LOADTEST_PASSWORD=${password}`);
    return username;
}

async function main() {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
    log(`Load test: ${PLAYERS} players, ${QUIZ.length} questions, ${SUPABASE_URL}`);

    const host = newClient();
    const bots = Array.from({ length: PLAYERS }, (_, i) => new Bot(i));
    let quizId = null;

    try {
        const username = await signInHost(host);
        log(`Host signed in as ${username}`);

        quizId = await rpc(host, 'save_quiz', {
            p_title: `Load test ${new Date().toISOString()}`,
            p_description: 'Made by scripts/load-test.mjs, deleted when it finishes',
            p_questions: QUIZ,
        });
        const session = await rpc(host, 'create_game', { p_quiz_id: quizId });
        log(`Game created, PIN ${session.pin}`);

        let lobby = [];
        let answered = 0;
        await subscribe(host, 'host', `host:${session.id}`, {
            playersChanged: (payload) => (lobby = payload.players),
            answerCount: (payload) => (answered = Math.max(answered, payload.answeredCount)),
        });

        // --- Lobby ----------------------------------------------------------
        await Promise.all(
            bots.map(async (bot) => {
                await sleep((bot.index * 1000) / JOINS_PER_SECOND);
                try {
                    await bot.join(session.pin);
                } catch (error) {
                    fail(bot.name, `could not join: ${error.message}`);
                }
            }),
        );
        const ready = bots.filter((bot) => bot.ready);
        log(`${ready.length}/${PLAYERS} bots joined, picked an avatar and are listening`);

        const lobbyComplete = await waitUntil(
            () => lobby.length === ready.length && ready.every((bot) => lobby.some((p) => p.name === bot.name && p.avatar === bot.avatar)),
            5000,
        );
        expect(lobbyComplete, 'host', `lobby shows ${lobby.length} players with their avatars, expected ${ready.length}`);
        if (ready.length === 0) throw new Error('no bots joined');

        // --- Questions ------------------------------------------------------
        let payload = await rpc(host, 'start_game', { p_session_id: session.id });
        const finalBoard = [];
        for (;;) {
            const n = payload.questionNumber;
            const questionId = payload.question.id;
            answered = 0;
            const { opensAt, deadline } = questionTimes(payload);

            // The host page ends the question when everyone has answered, or 1 s after time is up.
            const allAnswered = await waitUntil(() => answered >= ready.length, deadline + 1000 - Date.now());
            expect(allAnswered, `host Q${n}`, `answerCount reached ${answered}/${ready.length} before time ran out`);

            const results = await rpc(host, 'end_question', { p_session_id: session.id });
            const counted = results.answerCounts.reduce((sum, a) => sum + a.count, 0);
            const ms = Date.now() - opensAt;
            log(`Q${n}: ${results.answeredCount}/${results.totalPlayers} answered in ${(ms / 1000).toFixed(1)}s`);
            expect(results.totalPlayers === ready.length, `host Q${n}`, `totalPlayers is ${results.totalPlayers}`);
            expect(results.answeredCount === ready.length, `host Q${n}`, `answeredCount is ${results.answeredCount}`);
            expect(counted === results.answeredCount, `host Q${n}`, `answer counts add up to ${counted}`);
            expect(results.leaderboard.length === Math.min(5, ready.length), `host Q${n}`, `scoreboard has ${results.leaderboard.length} rows`);

            // While the host shows the counts and the scoreboard, every bot fetches its result.
            const resultsIn = await waitUntil(() => ready.every((bot) => bot.results.has(questionId)), 8000);
            const missing = ready.filter((bot) => !bot.results.has(questionId));
            expect(resultsIn, `Q${n}`, `no result for ${missing.map((b) => b.name).join(', ')}`);
            for (const bot of ready) {
                expect(bot.questionsSeen.has(questionId), bot.name, `never received question ${n}`);
                const answerId = bot.answers.get(questionId);
                const result = bot.results.get(questionId);
                if (answerId && result) {
                    expect(result.isCorrect === results.correctAnswerIds.includes(answerId), bot.name, `Q${n} isCorrect=${result.isCorrect} disagrees with the host`);
                }
            }
            let board = results.leaderboard;
            if (n === VOID_QUESTION) {
                const before = new Map(ready.map((bot) => [bot.name, bot.totalPoints - (bot.results.get(questionId)?.pointsEarned ?? 0)]));
                const voided = await rpc(host, 'void_question', { p_session_id: session.id });
                log(`Q${n}: host pressed "Don't count"`);
                expect(voided.voided === true, `host Q${n}`, 'void_question did not return voided: true');
                expect(voided.answeredCount === results.answeredCount, `host Q${n}`, 'answer counts changed after voiding');
                for (const row of voided.leaderboard) {
                    expect(row.lastPoints === 0 && row.rank === row.previousRank, 'host', `Q${n} voided scoreboard: ${row.playerName} +${row.lastPoints}, rank ${row.previousRank}→${row.rank}`);
                    expect(row.totalPoints === before.get(row.playerName), 'host', `Q${n} voided: ${row.playerName} has ${row.totalPoints}, expected ${before.get(row.playerName)}`);
                }
                // Every phone hears questionVoided and fetches its result again.
                const voidedIn = await waitUntil(() => ready.every((bot) => bot.results.get(questionId)?.voided), 8000);
                expect(voidedIn, `Q${n}`, `not told about the void: ${ready.filter((b) => !b.results.get(questionId)?.voided).map((b) => b.name).join(', ')}`);
                board = voided.leaderboard;
            }
            for (const row of board) {
                const bot = ready.find((b) => b.name === row.playerName);
                expect(bot?.totalPoints === row.totalPoints, 'host', `Q${n} scoreboard shows ${row.playerName} with ${row.totalPoints}, the bot has ${bot?.totalPoints}`);
            }

            await sleep(1500);
            const next = await rpc(host, 'next_question', { p_session_id: session.id });
            if (next.finished) {
                finalBoard.push(...next.leaderboard);
                break;
            }
            payload = next;
        }

        // --- End ------------------------------------------------------------
        const allFinished = await waitUntil(() => ready.every((bot) => bot.finished), 8000);
        expect(allFinished, 'end', `${ready.filter((b) => !b.finished).length} bots never saw the final results`);

        const hostState = await rpc(host, 'get_host_state', { p_session_id: session.id });
        expect(hostState.phase === 'finished', 'host', `final phase is ${hostState.phase}`);
        const ranking = [...ready].sort((a, b) => b.totalPoints - a.totalPoints);
        for (const row of finalBoard) {
            const bot = ready.find((b) => b.name === row.playerName);
            expect(bot?.totalPoints === row.totalPoints, 'host', `podium shows ${row.playerName} with ${row.totalPoints}, the bot has ${bot?.totalPoints}`);
        }
        log(`Winner: ${finalBoard[0]?.playerName} with ${finalBoard[0]?.totalPoints} (best bot total ${ranking[0].totalPoints})`);
    } finally {
        shuttingDown = true;
        await Promise.all([host, ...bots.map((b) => b.client)].map((c) => c.removeAllChannels()));
        if (quizId) {
            const { error } = await host.from('quizzes').delete().eq('id', quizId);
            if (error) warnings.push(`cleanup: could not delete the test quiz: ${error.message}`);
            else log('Deleted the test quiz, game and players');
        }
        await host.auth.signOut();
    }
}

function report() {
    console.log('\nDatabase calls (ms)      calls    p50    p95    max');
    for (const [fn, list] of [...timings].sort()) {
        const sorted = [...list].sort((a, b) => a - b);
        const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(0);
        console.log(`  ${fn.padEnd(22)} ${String(list.length).padStart(5)} ${at(0.5).padStart(6)} ${at(0.95).padStart(6)} ${sorted.at(-1).toFixed(0).padStart(6)}`);
    }
    if (warnings.length) {
        console.log(`\nWarnings (${warnings.length}):`);
        for (const w of warnings) console.log(`  ! ${w}`);
    }
    console.log(failures.length ? `\nFAILED: ${failures.length} problem(s)` : '\nPASSED: no errors from start to end');
}

main()
    .catch((error) => fail('test', error.message))
    .finally(() => {
        report();
        process.exit(failures.length ? 1 : 0);
    });
