import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { MessageCircle, Send, Mic, MicOff, Bot, User, Loader2, Database, Plus, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import styles from '../styles/ChatPage.module.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  lastTime: number;
  messages: ChatMessage[];
}

const ChatPage = () => {
  const { user, mlResults, weather, soil } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const language = 'English';
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Database context state
  const [mlTests, setMlTests] = useState<any[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [farmProfile, setFarmProfile] = useState<any>(null);

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

  const loadWelcomeMessage = (lang: 'English' | 'Kannada') => {
    return {
      id: 'welcome',
      role: 'assistant' as const,
      content: lang === 'English'
        ? "Hello! I am AgriSage AI. How can I help you with your farm today?"
        : "ನಮಸ್ಕಾರ! ನಾನು ಅಗ್ರಿಸೇಜ್ AI. ಇವತ್ತು ನಿಮ್ಮ ಕೃಷಿಗೆ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ?",
      timestamp: new Date()
    };
  };

  useEffect(() => {
    setMessages(prev => {
      const filtered = prev.filter(m => m.id !== 'welcome');
      return [loadWelcomeMessage(language), ...filtered];
    });
  }, [language]);

  // Load Database Context and Chat History
  useEffect(() => {
    const loadDatabaseContext = async () => {
      let sessionTests: any[] = [];
      try {
        sessionTests = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
      } catch (e) { console.warn(e); }

      let demoChatHistory: any[] = [];
      try {
        demoChatHistory = JSON.parse(sessionStorage.getItem('demo_chat_history') || '[]');
      } catch (e) { }

      if (!user) {
        // DEMO MODE - Dynamically build profile instead of hardcoding "Tomato"
        setFarmProfile({
          current_crop: mlResults.recommended_crop || "Unknown",
          soil_ph: soil?.ph || 7.0,
          environmental_conditions: weather ? { temp: weather.temperature, humidity: weather.humidity } : null
        });

        if (sessionTests.length > 0) {
          setMlTests(sessionTests.reverse());
        } else {
          setMlTests([]);
        }

        groupAndSetSessions(demoChatHistory);
        return;
      }

      // LOGGED IN MODE
      const { data: profile } = await supabase.from('farm_profiles').select('*').eq('user_id', user.id).single();
      if (profile) setFarmProfile(profile);

      const { data: dbTests } = await supabase.from('ml_tests_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);

      const combinedTests = [...sessionTests.reverse()];
      if (dbTests) combinedTests.push(...dbTests);
      setMlTests(combinedTests.slice(0, 10));

      const { data: chats } = await supabase.from('chat_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (chats) {
        groupAndSetSessions(chats);
      }
    };

    loadDatabaseContext();
  }, [user]);

  // Groups flat chat rows into distinct sessions based on a 30 min gap
  const groupAndSetSessions = (chats: any[]) => {
    if (chats.length === 0) return;
    chats.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const parsedSessions: ChatSession[] = [];
    let currentSess: ChatSession | null = null;

    chats.forEach(chat => {
      const time = new Date(chat.created_at).getTime();
      if (!currentSess || time - currentSess.lastTime > 30 * 60 * 1000) {
        currentSess = {
          id: chat.id || Date.now().toString(),
          title: chat.user_query,
          lastTime: time,
          messages: []
        };
        parsedSessions.push(currentSess);
      }
      currentSess.messages.push({ id: chat.id + '_u', role: 'user', content: chat.user_query, timestamp: new Date(chat.created_at) });
      currentSess.messages.push({ id: chat.id + '_a', role: 'assistant', content: chat.ai_response, timestamp: new Date(chat.created_at) });
      currentSess.lastTime = time;
    });

    setSessions(parsedSessions.reverse()); // Newest first

    // Auto-load latest session if no active session
    if (!currentSessionId && parsedSessions.length > 0) {
      setCurrentSessionId(parsedSessions[0].id);
      setMessages([loadWelcomeMessage(language), ...parsedSessions[0].messages]);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
    } else {
      if (recognition) {
        recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);
        recognition.onerror = () => setIsListening(false);
        recognition.start();
        setIsListening(true);
      } else {
        alert("Speech recognition is not supported in this browser.");
      }
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([loadWelcomeMessage(language)]);
  };

  const loadSession = (sess: ChatSession) => {
    setCurrentSessionId(sess.id);
    setMessages([loadWelcomeMessage(language), ...sess.messages]);
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
      const attachedTestsData = mlTests.filter(t => selectedTests.includes(t.id)).map(t => ({
        type: t.test_type,
        results: t.result_data,
        date: t.created_at
      }));

      const payload = {
        ml_results: {
          ...mlResults,
          farm_profile: farmProfile,
          attached_ml_tests: attachedTestsData
        },
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

        const dbEntry = {
          user_id: user?.id,
          user_query: userMessage.content,
          ai_response: assistantMessage.content,
          language: language,
          created_at: new Date().toISOString()
        };

        if (user) {
          try {
            await supabase.from('chat_history').insert(dbEntry);
          } catch (e) {
            console.warn("Could not save to chat_history table");
          }
        } else {
          // Demo Mode persistence
          try {
            const demoHist = JSON.parse(sessionStorage.getItem('demo_chat_history') || '[]');
            demoHist.push(dbEntry);
            sessionStorage.setItem('demo_chat_history', JSON.stringify(demoHist));
            groupAndSetSessions(demoHist);
          } catch (e) { }
        }
      }
    } catch (error) {
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

  const getTestLabel = (test: any) => {
    if (test.test_type === 'disease_detection') {
      return `🦠 Disease: ${test.result_data?.disease || 'Scan'}`;
    }
    if (test.test_type === 'ndvi_analysis') {
      return `🛰️ NDVI Score: ${test.result_data?.ndvi_score || 'Unknown'}`;
    }
    if (test.test_type === 'crop_recommendation') {
      const topCrop = test.result_data?.recommended_crops?.[0]?.crop || 'Unknown';
      return `🌱 Crop Rec: ${topCrop}`;
    }
    return `Test Data`;
  };

  return (
    <div className={styles.pageContainer}>
      {/* Sidebar for History */}
      <div className={styles.sidebar}>
        <div className="p-4 border-b border-earth-100 flex items-center justify-between">
          <h2 className="text-earth-900 font-bold flex items-center gap-2">
            <MessageSquare size={18} className="text-primary-600" /> Chats
          </h2>
          {!user && <span className="text-[10px] bg-accent-500 text-white px-2 py-0.5 rounded uppercase font-bold">Demo</span>}
        </div>
        <div className="p-3">
          <button onClick={startNewChat} className={styles.newChatBtn}>
            <Plus size={18} /> New Chat
          </button>
        </div>
        <div className={styles.sessionList}>
          {sessions.map(sess => (
            <button
              key={sess.id}
              onClick={() => loadSession(sess)}
              className={`${styles.sessionBtn} ${currentSessionId === sess.id ? styles.sessionBtnActive : ''}`}
            >
              {sess.title}
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="text-center text-earth-500 text-sm mt-10 px-4">
              No recent conversations found. Start a new chat!
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={styles.mainChat}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <MessageCircle className={styles.titleIcon} /> AgriSage AI
            </h1>
          </div>
        </header>

        {/* Chat Messages */}
        <div className={styles.chatScrollArea}>
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.msgWrapperBase} ${msg.role === 'user' ? styles.msgWrapperUser : styles.msgWrapperAssistant}`}>
              <div className={`${styles.avatarBase} ${msg.role === 'user' ? styles.avatarUser : styles.avatarAssistant}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={18} />}
              </div>
              <div className={`${styles.bubbleBase} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none text-left">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className={`${styles.msgWrapperBase} ${styles.msgWrapperAssistant}`}>
              <div className={`${styles.avatarBase} ${styles.avatarAssistant}`}>
                <Bot size={18} />
              </div>
              <div className={styles.loadingBubble}>
                <Loader2 className={styles.loadingSpinner} size={16} /> Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Context Selection Area */}
        {mlTests.length > 0 && (
          <div className="px-6 py-2.5 bg-earth-50/80 backdrop-blur-md border-t border-earth-100 flex items-center gap-3 overflow-x-auto border-b">
            <Database size={14} className="text-primary-600 flex-shrink-0" />
            <span className="text-[11px] font-bold text-earth-600 whitespace-nowrap uppercase tracking-wider">Attach Data:</span>
            {mlTests.map(test => (
              <button
                key={test.id}
                onClick={() => setSelectedTests(prev => prev.includes(test.id) ? prev.filter(id => id !== test.id) : [...prev, test.id])}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border shadow-sm ${selectedTests.includes(test.id)
                    ? 'bg-primary-500 text-white border-primary-600 shadow-primary-500/30'
                    : 'bg-white text-earth-700 border-earth-200 hover:bg-earth-100 hover:border-earth-300'
                  }`}
              >
                {getTestLabel(test)}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className={styles.inputContainer}>
          <div className="flex gap-2 w-full">
            <div className={styles.inputWrapper}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={language === 'English' ? "Ask AgriSage anything about your farm..." : "ನಿಮ್ಮ ಕೃಷಿ ಬಗ್ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ..."}
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
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
