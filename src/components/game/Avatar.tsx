import React from 'react';
import { avatarImage } from '../../lib/avatars';
import { cn } from '../../lib/utils';

// A player's avatar in a circle. Size it with className; text-* sets the size of
// an emoji avatar.
export const Avatar: React.FC<{ avatar: string; className?: string }> = ({ avatar, className }) => {
    const image = avatarImage(avatar);
    return (
        <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)}>
            {image ? <img src={image} alt="" draggable={false} className="h-full w-full" /> : avatar}
        </span>
    );
};
