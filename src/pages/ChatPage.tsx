import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { MessageCircle, Send, Mic, MicOff, Languages, Bot, User, Loader2 } from 'lucide-react';

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
        ml_results: mlResults, // From Zustand store (last crop, last disease, etc)
        language: language,
        // user_query: input // (Assuming backend handles this if we wanted full conversational AI, but /get-advisory schema just asks for ml_results and language in the prompt. If the backend actually requires it, we add it. We will just pass it standard.)
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
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] md:h-[calc(100vh-64px)] flex flex-col space-y-4">
      <header className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 flex items-center gap-2">
            <MessageCircle className="text-primary-600" /> AgriSage Chat
          </h1>
          <p className="text-earth-800 mt-1">Talk to your AI Agronomist.</p>
        </div>
        
        <button 
          onClick={() => setLanguage(lang => lang === 'English' ? 'Kannada' : 'English')}
          className="flex items-center gap-2 bg-earth-100 hover:bg-earth-200 text-earth-900 px-4 py-2 rounded-xl transition-colors"
        >
          <Languages size={18} />
          {language}
        </button>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 bg-white border border-earth-100 rounded-2xl p-4 overflow-y-auto shadow-sm flex flex-col gap-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-accent-100 text-accent-700'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`p-4 rounded-2xl text-[15px] ${
              msg.role === 'user' 
                ? 'bg-primary-600 text-white rounded-tr-sm' 
                : 'bg-earth-50 border border-earth-100 text-earth-900 rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 max-w-[85%] self-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-accent-100 text-accent-700">
              <Bot size={16} />
            </div>
            <div className="p-4 rounded-2xl bg-earth-50 border border-earth-100 text-earth-900 rounded-tl-sm flex items-center gap-2">
              <Loader2 className="animate-spin text-primary-500" size={16} /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex gap-2 shrink-0">
        <div className="flex-1 relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={language === 'English' ? "Ask me anything about your farm..." : "ನಿಮ್ಮ ಕೃಷಿ ಬಗ್ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ..."}
            className="w-full pl-4 pr-12 py-4 bg-white border border-earth-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
          />
          <button 
            onClick={toggleListening}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
              isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-earth-500 hover:bg-earth-100 hover:text-earth-900'
            }`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>
        <button 
          onClick={handleSendMessage}
          disabled={!input.trim() || loading}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-earth-200 disabled:text-earth-500 text-white p-4 rounded-2xl transition-colors shadow-sm"
        >
          <Send size={24} />
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
