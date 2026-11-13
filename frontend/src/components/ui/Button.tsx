import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    icon?: ReactNode;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    title?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
    children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            variant = 'primary',
            size = 'md',
            isLoading,
            icon,
            className = '',
            disabled,
            onClick,
            type,
            title,
            ...ariaProps
        },
        ref
    ) => {
        const { t } = useTranslation();
        const baseStyles =
            'bl-button inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

        const variants = {
            primary:
                'bg-bl-action hover:brightness-105 text-bl-on-action focus:ring-bl-accent',
            secondary:
                'border-bl-border bg-bl-surface dark:bg-bl-surface hover:bg-bl-recessed dark:hover:bg-bl-border text-bl-ink dark:text-bl-ink focus:ring-bl-border',
            danger: 'bg-bl-danger-solid hover:bg-bl-danger-solid/90 text-white focus:ring-bl-danger',
            ghost: 'bg-transparent hover:bg-bl-surface dark:hover:bg-bl-surface text-bl-ink dark:text-bl-ink focus:ring-bl-border',
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-base',
            lg: 'px-6 py-3 text-lg',
        };

        const isDisabled = disabled || isLoading;

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
                disabled={isDisabled}
                onClick={onClick}
                type={type}
                title={title}
                aria-busy={isLoading}
                {...ariaProps}
            >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <span>{t('common.loadingPleaseWait')}</span>
                    </span>
                ) : (
                    <>
                        {icon && <span aria-hidden="true">{icon}</span>}
                        {children}
                    </>
                )}
            </motion.button>
        );
    }
);

Button.displayName = 'Button';
