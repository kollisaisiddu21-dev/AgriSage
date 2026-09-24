import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { MessageCircle, Send, Mic, MicOff, Languages, Bot, User, Loader2 } from 'lucide-react';
import styles from '../styles/ChatPage.module.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ChatPage = () => {
  const { user, mlResults } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<'English' | 'Kannada'>('English');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Web Speech API
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;
  
  if (recognition) {
    recognition.continuous = false;
    recognition.lang = language === 'English' ? 'en-US' : 'kn-IN';
    recognition.interimResults = false;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Load initial welcome message
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: language === 'English' 
          ? "Hello! I am AgriSage AI. How can I help you with your farm today?"
          : "ನಮಸ್ಕಾರ! ನಾನು ಅಗ್ರಿಸೇಜ್ AI. ಇವತ್ತು ನಿಮ್ಮ ಕೃಷಿಗೆ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ?",
        timestamp: new Date()
      }
    ]);
  }, [language]);

  const toggleListening = () => {
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
    } else {
      if (recognition) {
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
        };
        recognition.onerror = () => {
          setIsListening(false);
        };
        recognition.start();
        setIsListening(true);
      } else {
        alert("Speech recognition is not supported in this browser.");
      }
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // In a real chatbot, we might pass the full chat history. 
      // The instructions say: "The chat must utilize the /get-advisory API. Pass the user's current metrics in the ml_results payload"
        const payload = {
          ml_results: mlResults, 
          language: language,
          user_query: input,
          chat_history: messages
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content }))
        };

      const res = await api.getAdvisory(payload);

      if (res.status === 'success') {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.advisory,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);

        // Save to Supabase History
        if (user) {
          try {
            await supabase.from('chat_history').insert({
              user_id: user.id,
              user_query: userMessage.content,
              ai_response: assistantMessage.content,
              language: language
            });
          } catch (e) {
            console.warn("Could not save to chat_history table");
          }
        }
      }
    } catch (error) {
      console.error("Failed to get advisory", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't process that request at the moment. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <MessageCircle className={styles.titleIcon} /> AgriSage Chat
          </h1>
          <p className={styles.subtitle}>Talk to your AI Agronomist.</p>
        </div>
        
        <button 
          onClick={() => setLanguage(lang => lang === 'English' ? 'Kannada' : 'English')}
          className={styles.langButton}
        >
          <Languages size={18} />
          {language}
        </button>
      </header>

      {/* Chat Messages */}
      <div className={styles.chatContainer}>
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.msgWrapperBase} ${msg.role === 'user' ? styles.msgWrapperUser : styles.msgWrapperAssistant}` }>
            <div className={`${styles.avatarBase} ${msg.role === 'user' ? styles.avatarUser : styles.avatarAssistant}` }>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`${styles.bubbleBase} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.msgWrapperBase} ${styles.msgWrapperAssistant}` }>
            <div className={`${styles.avatarBase} ${styles.avatarAssistant}` }>
              <Bot size={16} />
            </div>
            <div className={styles.loadingBubble}>
              <Loader2 className={styles.loadingSpinner} size={16} /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={language === 'English' ? "Ask me anything about your farm..." : "ನಿಮ್ಮ ಕೃಷಿ ಬಗ್ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ..."}
            className={styles.textInput}
          />
          <button 
            onClick={toggleListening}
            className={`${styles.micBtnBase} ${isListening ? styles.micBtnListening : styles.micBtnIdle}`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>
        <button 
          onClick={handleSendMessage}
          disabled={!input.trim() || loading}
          className={styles.sendBtn}
        >
          <Send size={24} />
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
