'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import { Message, VisaType } from '@/types'
import { api, apiUtils } from '@/utils/api'
import { Button, Badge } from '@/components/UI'
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
  const [isBackendAvailable, setIsBackendAvailable] = useState(true)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check backend availability on component mount
  useEffect(() => {
    checkBackendHealth()
  }, [])

  const checkBackendHealth = async () => {
    const available = await apiUtils.isBackendAvailable()
    setIsBackendAvailable(available)
    
    if (!available) {
      showError('Backend not available - using demo mode')
    }
  }

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
      if (!isBackendAvailable) {
        // Fallback to mock response
        const mockResponse = getMockChatResponse(input.trim())
        const avaMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: mockResponse.response,
          sender: 'ava',
          timestamp: new Date(),
          metadata: {
            suggestedVisaType: mockResponse.suggestedVisaType,
            nextAction: mockResponse.nextAction,
            confidence: mockResponse.confidence
          }
        }
        setMessages(prev => [...prev, avaMessage])
        
        // Trigger visa type selection if needed
        if (mockResponse.nextAction === 'start_form' && mockResponse.suggestedVisaType && onVisaTypeSelected) {
          setTimeout(() => {
            onVisaTypeSelected(mockResponse.suggestedVisaType!)
          }, 1000)
        }
      } else {
        // Use real backend
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

        // If AVA suggests starting a form, trigger the callback
        if (response.nextAction === 'start_form' && response.suggestedVisaType && onVisaTypeSelected) {
          showSuccess(`Starting ${response.suggestedVisaType} visa application!`)
          setTimeout(() => {
            onVisaTypeSelected(response.suggestedVisaType!)
          }, 1000)
        }
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const quickReplies = [
    "I need a tourist visa",
    "Business visa application", 
    "Student visa help",
    "Family visit visa"
  ]

  const handleQuickReply = (reply: string) => {
    setInput(reply)
    setTimeout(() => sendMessage(), 100)
  }

  return (
    <div className="flex flex-col h-full bg-base-100 rounded-lg shadow-lg overflow-hidden border border-base-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-secondary text-white p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="avatar">
              <div className="w-10 rounded-full bg-base-100">
                <Bot className="w-6 h-6 text-primary m-2" />
              </div>
            </div>
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse ${
              isBackendAvailable ? 'bg-success' : 'bg-warning'
            }`} />
          </div>
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              AVA - AI Visa Assistant
              <Badge variant="ghost" className="text-xs bg-white/20 text-white border-white/30">
                <Sparkles className="w-3 h-3 mr-1" />
                {isBackendAvailable ? 'AI' : 'Demo'}
              </Badge>
            </h3>
            <p className="text-primary-content/70 text-sm">
              {isBackendAvailable ? 'Online • Ready to help' : 'Demo mode • Limited functionality'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-50">
        {messages.map(message => (
          <div
            key={message.id}
            className={`chat ${message.sender === 'user' ? 'chat-end' : 'chat-start'} chat-message`}
          >
            <div className="chat-image avatar">
              <div className="w-8 rounded-full">
                {message.sender === 'ava' ? (
                  <div className="bg-primary text-white rounded-full flex items-center justify-center w-8 h-8">
                    <Bot className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="bg-neutral text-white rounded-full flex items-center justify-center w-8 h-8">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            </div>
            
            <div className={`chat-bubble ${
              message.sender === 'user' 
                ? 'chat-bubble-primary' 
                : 'chat-bubble-secondary'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
              
              {/* Show confidence for AVA messages */}
              {message.sender === 'ava' && message.metadata?.confidence && (
                <div className="mt-2 pt-2 border-t border-white/20">
                  <Badge variant="ghost" size="xs" className="bg-white/20 text-white border-white/30">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {Math.round(message.metadata.confidence * 100)}% confident
                  </Badge>
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
          <div className="chat chat-start">
            <div className="chat-image avatar">
              <div className="w-8 rounded-full">
                <div className="bg-primary text-white rounded-full flex items-center justify-center w-8 h-8">
                  <Bot className="w-5 h-5" />
                </div>
              </div>
            </div>
            <div className="chat-bubble chat-bubble-secondary">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                <div 
                  className="w-2 h-2 bg-current rounded-full animate-bounce" 
                  style={{ animationDelay: '0.1s' }} 
                />
                <div 
                  className="w-2 h-2 bg-current rounded-full animate-bounce" 
                  style={{ animationDelay: '0.2s' }} 
                />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {messages.length === 1 && (
        <div className="px-4 py-3 bg-base-200 border-t border-base-300">
          <p className="text-xs opacity-60 mb-2">Quick options:</p>
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply, index) => (
              <Button
                key={index}
                variant="ghost"
                size="xs"
                onClick={() => handleQuickReply(reply)}
                className="text-xs"
              >
                {reply}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-base-100 border-t border-base-300">
        <div className="flex gap-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask AVA anything about visas..."
              className="textarea textarea-bordered w-full resize-none"
              rows={1}
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            loading={isLoading}
            className="btn-circle"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs opacity-50 mt-2 text-center">
          AVA can make mistakes. Please verify important information.
          {!isBackendAvailable && ' • Currently in demo mode'}
        </p>
      </div>
    </div>
  )
}

// Mock chat response for fallback
function getMockChatResponse(message: string): any {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('tourist') || lowerMessage.includes('vacation') || lowerMessage.includes('holiday')) {
    return {
      response: "Perfect! For a tourist visa, you'll typically need a passport, bank statements, travel insurance, and a travel itinerary. The process usually takes 5-10 business days. Would you like me to start your application?",
      suggestedVisaType: 'tourist',
      nextAction: 'start_form',
      confidence: 0.9
    }
  }
  
  if (lowerMessage.includes('business') || lowerMessage.includes('work') || lowerMessage.includes('conference')) {
    return {
      response: "Great! For a business visa, you'll need an invitation letter from the company, your employment details, and proof of business activities. This typically takes 7-15 business days. Shall we begin your application?",
      suggestedVisaType: 'business',
      nextAction: 'start_form',
      confidence: 0.85
    }
  }
  
  return {
    response: "I'm running in demo mode. I can help you with tourist, business, student, work, or family visit visas. What type of travel are you planning?",
    nextAction: 'continue_chat',
    confidence: 0.5
  }
}