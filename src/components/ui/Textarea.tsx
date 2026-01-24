import { forwardRef, TextareaHTMLAttributes, useId } from "react"

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const autoId = useId()
    const textareaId = id ?? `textarea-${autoId}`

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-900 mb-1.5"
          >
            {label}
            {props.required && <span className="text-icc-rouge ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`w-full px-4 py-2.5 border-2 rounded-lg transition-all duration-200 resize-none text-gray-900 bg-white
            ${
              error
                ? "border-icc-rouge focus:ring-icc-rouge/20 focus:border-icc-rouge"
                : "border-gray-300 hover:border-icc-violet/50 focus:border-icc-violet focus:ring-4 focus:ring-icc-violet/10"
            }
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50
            placeholder:text-gray-400
            ${className}`}
          {...props}
        />
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

Textarea.displayName = "Textarea"

export { Textarea }
