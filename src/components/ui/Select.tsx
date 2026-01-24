"use client"

import { forwardRef, SelectHTMLAttributes, useId, useState } from "react"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className = "",
      label,
      error,
      helperText,
      id,
      children,
      onChange,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const autoId = useId()
    const selectId = id ?? `select-${autoId}`
    const isControlled = value !== undefined
    const [internalValue, setInternalValue] = useState(
      (defaultValue as string | undefined) ?? ""
    )
    const currentValue = isControlled ? value : internalValue
    const isPlaceholder = currentValue === ""

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-900 mb-1.5"
          >
            {label}
            {props.required && <span className="text-icc-rouge ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full px-4 py-2.5 border-2 rounded-lg transition-all duration-200 bg-white ${
            isPlaceholder ? "text-gray-500" : "text-gray-900"
          }
            ${
              error
                ? "border-icc-rouge focus:ring-icc-rouge/20 focus:border-icc-rouge"
                : "border-gray-300 hover:border-icc-violet/50 focus:border-icc-violet focus:ring-4 focus:ring-icc-violet/10"
            }
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
            ${className}`}
          value={currentValue}
          onChange={(e) => {
            if (!isControlled) {
              setInternalValue(e.target.value)
            }
            onChange?.(e)
          }}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1.5 text-sm text-icc-rouge flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-600">{helperText}</p>
        )}
      </div>
    )
  }
)

Select.displayName = "Select"

export { Select }
