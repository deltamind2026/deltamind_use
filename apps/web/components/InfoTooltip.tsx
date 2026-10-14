'use client';

import React, { useId, useState } from 'react';

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      style={{
        display: 'inline-flex',
        position: 'relative',
        alignItems: 'center',
        marginLeft: 6,
        verticalAlign: 'middle',
      }}
    >
      <button
        type="button"
        aria-label={`More information: ${text}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={(e) => {
            e.stopPropagation();
            setOpen(previous => !previous);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: '#94a3b8',
          cursor: 'help',
          fontSize: 14,
        }}
      >
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            width: 220,
            padding: '10px 12px',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            color: '#e5e7eb',
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.5,
            whiteSpace: 'normal',
            textAlign: 'left',
            textTransform: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 50,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}