'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, User } from 'lucide-react'
import { Message, VisaType } from '@/types'
import { api, apiUtils } from '@/utils/api'
// Removed send Button; using Enter key to submit
import { useAlertStore } from '@/lib/stores/alert.store'

interface ChatInterfaceProps {
  onVisaTypeSelected?: (visaType: VisaType) => void
}

export default function ChatInterface({ onVisaTypeSelected }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm AVA, your AI visa assistant. I can help you find the right visa and guide you through the application process. What type of travel are you planning? 🛂✈️",
      sender: 'ava',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => apiUtils.generateSessionId())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { showError, showSuccess } = useAlertStore()
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Removed backend availability + mock fallback

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Always use real backend now
      const response = await api.chat(input.trim(), sessionId)
      const avaMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        sender: 'ava',
        timestamp: new Date(),
        metadata: {
          suggestedVisaType: response.suggestedVisaType,
          nextAction: response.nextAction,
          confidence: response.confidence
        }
      }
      setMessages(prev => [...prev, avaMessage])
      if (response.nextAction === 'start_form' && response.suggestedVisaType && onVisaTypeSelected) {
        showSuccess(`Starting ${response.suggestedVisaType} visa application!`)
        setTimeout(() => {
          onVisaTypeSelected(response.suggestedVisaType!)
        }, 5000)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        sender: 'ava',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      showError('Failed to send message - please try again')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Auto resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
    }
  }, [input])

  const quickReplies = [
    "I need a tourist visa",
    "Business visa application", 
    "Student visa help",
    "Family visit visa"
  ]

  const handleQuickReply = (reply: string) => {
    setInput(reply)
    // Focus the textarea so user can immediately press Enter to send
    // Use a microtask to ensure state has propagated before manipulating selection
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        // Place cursor at end
        const len = inputRef.current.value.length
        try {
          inputRef.current.setSelectionRange(len, len)
        } catch {}
      }
    }, 0)
  }

  return (
    <div className="flex flex-col h-full bg-base-100 rounded-xl shadow-soft border border-base-300/60 overflow-hidden">
      {/* Header */}
      <div className="bg-base-200/70 backdrop-blur border-b border-base-300/70 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">AVA Assistant</h3>
            <div className="flex items-center gap-1 text-xs opacity-70">
              <span>Online</span>
            </div>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wide opacity-60">Session {sessionId.slice(-6)}</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-100">
        {messages.map(message => (
          <div
            key={message.id}
            className={`chat ${message.sender === 'user' ? 'chat-end' : 'chat-start'} chat-message`}
          >
            <div className="chat-image avatar">
              <div className="w-6 rounded-full">
                {message.sender === 'ava' ? (
                  <div className="bg-primary text-white rounded-full flex items-center justify-center w-6 h-6">
                    <Bot className="w-3 h-3" />
                  </div>
                ) : (
                  <div className="bg-base-300 text-base-content rounded-full flex items-center justify-center w-6 h-6">
                    <User className="w-3 h-3" />
                  </div>
                )}
              </div>
            </div>
            
            <div className={`chat-bubble max-w-[75%] ${
              message.sender === 'user'
                ? 'chat-bubble-primary'
                : 'bg-base-200 text-base-content'
            } shadow-sm`}>
              <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-[15px]">{message.text}</p>
              
              {/* Show confidence for AVA messages */}
              {message.sender === 'ava' && message.metadata?.confidence !== undefined && (
                <div className="mt-2 pt-2 border-t border-base-content/10">
                  <span className="text-xs opacity-60">
                    Confidence: {Math.round(message.metadata.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>
            
            <div className="chat-footer opacity-50 text-xs">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="chat chat-start animate-fadeIn">
            <div className="chat-image avatar">
              <div className="w-6 rounded-full">
                <div className="bg-primary text-white rounded-full flex items-center justify-center w-6 h-6">
                  <Bot className="w-3 h-3" />
                </div>
              </div>
            </div>
            <div className="chat-bubble bg-base-200 text-base-content">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {messages.length === 1 && (
        <div className="px-4 py-3 bg-base-200/60 backdrop-blur border-t border-base-300/70">
          <p className="text-xs opacity-60 mb-2">Try one of these:</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {quickReplies.map((reply, index) => (
              <button
                key={index}
                onClick={() => handleQuickReply(reply)}
                className="px-3 py-1.5 rounded-full bg-base-100 border border-base-300 text-xs hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area (reverted simpler layout) */}
      <div className="p-4 bg-base-100/90 backdrop-blur border-t border-base-300/70">
        <div className="relative">
          <textarea
            id="chat-input"
            aria-describedby="chat-input-hint"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AVA anything about visas..."
            className="w-full resize-none rounded-xl border border-base-300 bg-base-100 px-4 py-3 pr-16 text-sm leading-relaxed shadow-inner min-h-[48px] focus:outline-none no-focus-jump transition-none"
            rows={1}
            disabled={isLoading}
          />
          {/* Optional inline send icon (passive) */}
        </div>
        <p className="text-[10px] opacity-40 mt-2 text-center tracking-wide uppercase">
          AI assistance − verify important information
        </p>
      </div>
    </div>
  )
}

// Removed mock fallback logic