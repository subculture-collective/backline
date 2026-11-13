import type { SVGProps } from 'react';

/** The Backline mark: a road case with handle, four corner plates and an amber latch. */
export function Mark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 40 32" aria-hidden="true" {...props}>
            <rect
                x="3"
                y="5"
                width="34"
                height="24"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
            />
            <rect
                x="14"
                y="1"
                width="12"
                height="4"
                rx="1"
                fill="currentColor"
            />
            <path
                fill="rgb(var(--bl-hardware))"
                d="M1.5 3.5h8v3h-5v5h-3zM38.5 3.5h-8v3h5v5h3zM1.5 30.5h8v-3h-5v-5h-3zM38.5 30.5h-8v-3h5v-5h3z"
            />
            <rect
                x="14"
                y="13"
                width="12"
                height="8"
                rx="1"
                fill="rgb(var(--bl-action))"
                stroke="rgb(var(--bl-action-edge))"
                strokeWidth="1"
            />
            <rect
                x="19"
                y="15.5"
                width="2"
                height="3.5"
                fill="rgb(var(--bl-canvas))"
            />
        </svg>
    );
}

const paths = {
    welcome: (
        <>
            <path d="M11 3h9v18h-9" />
            <path d="M11 3L5 5.5v14L11 21z" />
            <path d="M8.5 11.5v2" />
        </>
    ),
    safety: (
        <>
            <path d="M12 3l8 3v6c0 4.6-3.4 7.8-8 9-4.6-1.2-8-4.4-8-9V6z" />
            <path d="M8.5 12l2.5 2.5 4.5-5" />
        </>
    ),
    engage: (
        <>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 20v-1.5A5.5 5.5 0 0 1 8.5 13h1a5.5 5.5 0 0 1 5.5 5.5V20" />
            <path d="M15.5 5.2a3 3 0 0 1 0 5.6M18 13.4a5 5 0 0 1 3 4.6V20" />
        </>
    ),
    automate: (
        <>
            <circle cx="7" cy="13" r="4" />
            <circle cx="17" cy="13" r="4" />
            <path d="M7 9h10M3 20h18M7 12.5v1M17 12.5v1" />
        </>
    ),
    operator: <path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0zM12 18v3" />,
    stage: (
        <>
            <path d="M4 5h7v6H4z" />
            <path d="M11 6.5l9-3M11 9.5l9 6M7.5 11v8M4 20h7" />
        </>
    ),
    loadin: (
        <>
            <path d="M5 5h12v9H5zM9 3h4M3 17h17" />
            <circle cx="7" cy="19.5" r="1.5" />
            <circle cx="16" cy="19.5" r="1.5" />
        </>
    ),
    arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
    external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
};

export type IconName = keyof typeof paths;

/** Road Case icons: 24px grid, 1.75 stroke, square ends. Always pair with a text label. */
export function Icon({
    name,
    size = 20,
    ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={size <= 16 ? 2 : 1.75}
            strokeLinecap="square"
            strokeLinejoin="miter"
            aria-hidden="true"
            {...props}
        >
            {paths[name]}
        </svg>
    );
}
