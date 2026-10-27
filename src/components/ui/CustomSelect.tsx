'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  variant?: 'pill' | 'card' | 'input';
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  disabled?: boolean;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className,
  buttonClassName,
  menuClassName,
  variant = 'pill',
  size = 'sm',
  align = 'right',
  disabled = false,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = useCallback(
    (optValue: T) => {
      onChange(optValue);
      setIsOpen(false);
    },
    [onChange],
  );

  const variantStyles = {
    pill: 'rounded-pill border border-[var(--border-subtle)] bg-bg-surface hover:border-brand-emerald/40',
    card: 'rounded-card border border-[var(--border-subtle)] bg-bg-surface hover:border-brand-emerald/40',
    input: 'rounded-button border border-[var(--border-subtle)] bg-bg-primary hover:border-brand-emerald/40',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-xs',
  };

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'flex items-center justify-between gap-2 font-medium text-content-primary shadow-xs transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-brand-emerald/50',
          variantStyles[variant],
          sizeStyles[size],
          isOpen && 'border-brand-emerald bg-bg-elevated/70 ring-1 ring-brand-emerald/30',
          disabled && 'cursor-not-allowed opacity-50',
          buttonClassName,
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          {selectedOption?.badge && <span className="shrink-0">{selectedOption.badge}</span>}
        </div>
        <ChevronDown
          size={13}
          className={cn(
            'shrink-0 text-content-muted transition-transform duration-200',
            isOpen && 'rotate-180 text-brand-emerald',
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={cn(
            'absolute top-full mt-1.5 z-50 min-w-[190px] max-w-[280px] p-1.5 overflow-hidden',
            'rounded-2xl border border-[var(--border-strong)] bg-bg-elevated',
            'backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          <div className="space-y-0.5 max-h-60 overflow-y-auto overscroll-contain">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-brand-emerald/10 font-bold text-brand-emerald'
                      : 'text-content-secondary hover:bg-bg-elevated hover:text-content-primary',
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <span className="truncate">{option.label}</span>
                    {option.badge && <span className="shrink-0">{option.badge}</span>}
                  </div>
                  {isSelected && (
                    <Check size={13} className="shrink-0 text-brand-emerald ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
