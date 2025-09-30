import React from 'react'

interface StatProps {
  title: string
  value: string | number
  description?: string
  className?: string
}

const Stat: React.FC<StatProps> = ({ title, value, description, className = '' }) => {
  return (
    <div className={`stat ${className}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {description && <div className="stat-desc">{description}</div>}
    </div>
  )
}

interface StatsProps {
  children: React.ReactNode
  className?: string
  vertical?: boolean
}

const Stats: React.FC<StatsProps> = ({ children, className = '', vertical = false }) => {
  const statsClass = vertical 
    ? 'stats stats-vertical shadow bg-base-200' 
    : 'stats stats-vertical lg:stats-horizontal shadow bg-base-200'

  return (
    <div className={`${statsClass} ${className}`}>
      {children}
    </div>
  )
}

export { Stats, Stat }