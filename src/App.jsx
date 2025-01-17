import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import hljs from 'highlight.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane, 
  faRobot, 
  faCircle, 
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import 'highlight.js/styles/github.css';
import './App.css';

const App = () => {
  // State to manage chat messages
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);

  // Refs for managing textarea and scrolling behavior
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize Google Generative AI instance
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

  // Scroll to the bottom of the messages container
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Highlight code blocks and scroll to the bottom when messages update
  useEffect(() => {
    scrollToBottom();
    hljs.highlightAll();
  }, [messages]);

  // Adjust textarea height dynamically and disable page scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 50), 150)}px`;
    }
  }, [input]);

  // Markdown renderer for assistant responses
  const MarkdownRenderer = ({ content }) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline ? (
              <code 
                className={`hljs ${className}`} 
                style={{
                  display: 'block',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  padding: '10px',
                  borderRadius: '4px',
                  backgroundColor: '#f4f4f4',
                  margin: '10px 0'
                }}
                {...props}
              >
                {children}
              </code>
            ) : (
              <code 
                className={className} 
                style={{
                  backgroundColor: '#f4f4f4',
                  padding: '2px 4px',
                  borderRadius: '3px'
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          p: ({ children }) => (
            <p style={{ 
              whiteSpace: 'pre-wrap', 
              wordWrap: 'break-word', 
              margin: '10px 0',
              lineHeight: '1.6'
            }}>
              {children}
            </p>
          ),
          pre: ({ children }) => (
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordWrap: 'break-word', 
              margin: '10px 0',
              padding: '10px',
              backgroundColor: '#f4f4f4',
              borderRadius: '4px'
            }}>
              {children}
            </pre>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  // Handle sending a new message
  const handleSend = async () => {
    const trimmedInput = input.trim(); // Trim input to remove unnecessary spaces
    if (!trimmedInput) return; // Prevent sending empty messages

    const userMessage = { role: 'user', content: trimmedInput };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsThinking(true);

    try {
      // Prepare context for the AI model
      const contextMessages = conversationHistory.length > 0 
        ? conversationHistory.map(msg => ({
            parts: [{ text: msg.content }],
            role: msg.role === 'user' ? 'user' : 'model'
          }))
        : [];

      contextMessages.push({
        parts: [{ text: trimmedInput }],
        role: 'user'
      });

      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: "text/plain",
        }
      });

      // Stream AI response
      const result = await model.generateContentStream({
        contents: contextMessages
      });

      let accumulatedResponse = '';
      const aiMessage = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, aiMessage]);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        accumulatedResponse += chunkText;
        
        setMessages(prev => {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1].content = accumulatedResponse;
          return updatedMessages;
        });
      }

      const newConversationHistory = [
        ...conversationHistory, 
        userMessage, 
        { role: 'assistant', content: accumulatedResponse }
      ];

      setConversationHistory(newConversationHistory);
      setIsThinking(false);
    } catch (error) {
      console.error(error);
      setIsThinking(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request.' 
      }]);
    }
  };

  // Handle keyboard shortcuts for sending messages
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        e.preventDefault();
        setInput(prev => prev + '\n');
      } else if (window.innerWidth > 768) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  return (
    <div className="chat-container">
      <header>
        <div className="header-left">
          <FontAwesomeIcon 
            icon={faRobot} 
            className="ai-icon" 
          />
          <div>
            <h2>AI Assistant</h2>
            <span className="online-status">
              <FontAwesomeIcon icon={faCircle} />
            </span>
          </div>
        </div>
      </header>

      <div className="messages-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                <p style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordWrap: 'break-word', 
                  margin: 0 
                }}>
                  {msg.content}
                </p>
              )}
            </div>
          ))}
          {isThinking && (
            <div className="message assistant thinking">
              <FontAwesomeIcon icon={faSpinner} spin /> Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={1}
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word'
          }}
        />
        <button 
          onClick={handleSend} 
          disabled={isThinking || !input.trim()}
          className="send-button"
        >
          {isThinking ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin /> Sending...
            </>
          ) : (
            <FontAwesomeIcon icon={faPaperPlane} />
          )}
        </button>
      </div>
    </div>
  );
};

export default App;
