import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
}

const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`card bg-base-200 shadow ${className}`}>
      <div className="card-body">
        {title && <h3 className="card-title">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

export default Card