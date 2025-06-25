import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  compact?: boolean
  bordered?: boolean
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  title, 
  compact = false,
  bordered = false 
}) => {
  const cardClasses = [
    'card',
    'bg-base-100',
    'shadow-lg',
    bordered ? 'card-bordered' : '',
    compact ? 'card-sm' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClasses}>
      <div className="card-body">
        {title && <h3 className="card-title">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

export default Card