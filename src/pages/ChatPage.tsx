import { useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { MessageCircle, Send, Mic, MicOff, Sprout, User, Database, Plus, MessageSquare, Menu, X } from 'lucide-react';
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
  const { user, isDemoMode, mlResults, weather, soil, testStates, setTestState } = useAppStore();
  const pageState = testStates['chat'] || {};

  const messages = pageState.messages || [];
  const sessions = pageState.sessions || [];
  const currentSessionId = pageState.currentSessionId || null;
  const input = pageState.input || '';
  const language = 'English';
  const loading = pageState.loading || false;
  const loadingDb = pageState.loadingDb ?? true;
  const isListening = pageState.isListening || false;
  const mlTests = pageState.mlTests || [];
  const selectedTests = pageState.selectedTests || [];
  const farmProfile = pageState.farmProfile || null;
  const showContextBox = pageState.showContextBox || false;
  const showMobileSidebar = pageState.showMobileSidebar || false;

  const setMessages = (val: any) => {
    const curr = useAppStore.getState().testStates['chat'] || {};
    setTestState('chat', { messages: typeof val === 'function' ? val(curr.messages || []) : val });
  };
  const setSessions = (val: any) => {
    const curr = useAppStore.getState().testStates['chat'] || {};
    setTestState('chat', { sessions: typeof val === 'function' ? val(curr.sessions || []) : val });
  };
  const setCurrentSessionId = (val: string | null) => setTestState('chat', { currentSessionId: val });
  const setInput = (val: string) => setTestState('chat', { input: val });
  const setLoading = (val: boolean) => setTestState('chat', { loading: val });
  const setLoadingDb = (val: boolean) => setTestState('chat', { loadingDb: val });
  const setIsListening = (val: boolean) => setTestState('chat', { isListening: val });
  const setMlTests = (val: any[]) => setTestState('chat', { mlTests: val });
  const setSelectedTests = (val: any) => {
    const curr = useAppStore.getState().testStates['chat'] || {};
    setTestState('chat', { selectedTests: typeof val === 'function' ? val(curr.selectedTests || []) : val });
  };
  const setFarmProfile = (val: any) => setTestState('chat', { farmProfile: val });
  const setShowContextBox = (val: any) => {
    const curr = useAppStore.getState().testStates['chat'] || {};
    setTestState('chat', { showContextBox: typeof val === 'function' ? val(curr.showContextBox || false) : val });
  };
  const setShowMobileSidebar = (val: boolean) => setTestState('chat', { showMobileSidebar: val });
  const contextBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextBoxRef.current && !contextBoxRef.current.contains(event.target as Node)) {
        setShowContextBox(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  // Web Speech API
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  if (recognition) {
    recognition.continuous = false;
    recognition.lang = language === 'English' ? 'en-US' : 'kn-IN';
    recognition.interimResults = false;
  }

  // Web Speech API

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

      const { data: dbTests } = await supabase.from('history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);

      const combinedTests = [...sessionTests.reverse()];
      if (dbTests) {
        const mappedDb = dbTests.map(d => ({
          id: d.id,
          test_type: d.type === 'Crop Recommendation' ? 'crop_recommendation' : d.type === 'Disease Diagnosis' ? 'disease_detection' : 'ndvi_analysis',
          result_data: d.full_data,
          created_at: d.created_at
        }));
        combinedTests.push(...mappedDb);
      }

      // Deduplicate by test_type and time (within 60s)
      const uniqueTests: any[] = [];
      for (const item of combinedTests) {
        const timeKey = new Date(item.created_at).getTime();
        const isDuplicate = uniqueTests.some(u =>
          u.test_type === item.test_type &&
          Math.abs(new Date(u.created_at).getTime() - timeKey) < 60000
        );
        if (!isDuplicate) {
          uniqueTests.push(item);
        }
      }

      uniqueTests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMlTests(uniqueTests.slice(0, 15));

      const { data: chats } = await supabase.from('chat_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (chats) {
        groupAndSetSessions(chats);
      }
      setLoadingDb(false);
    };

    loadDatabaseContext();
  }, [user]);

  // Groups flat chat rows into distinct sessions based on session_id (or time fallback for legacy)
  const groupAndSetSessions = (chats: any[]) => {
    if (chats.length === 0) return;
    chats.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const parsedSessions: ChatSession[] = [];

    chats.forEach(chat => {
      const time = new Date(chat.created_at).getTime();
      // Use session_id if available, otherwise fallback to a 30-min window bucket for legacy chats
      const sessionId = chat.session_id || `legacy_${Math.floor(time / (30 * 60 * 1000))}`;

      let currentSess = parsedSessions.find(s => s.id === sessionId);
      if (!currentSess) {
        currentSess = {
          id: sessionId,
          title: chat.user_query,
          lastTime: time,
          messages: []
        };
        parsedSessions.push(currentSess);
      }
      currentSess.messages.push({ id: chat.id + '_u', role: 'user', content: chat.user_query, timestamp: new Date(chat.created_at) });
      currentSess.messages.push({ id: chat.id + '_a', role: 'assistant', content: chat.ai_response, timestamp: new Date(chat.created_at) });
      currentSess.lastTime = Math.max(currentSess.lastTime, time);
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

    // Auto-scroll to bottom when switching sessions
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 50);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    let activeSession = currentSessionId;
    if (!activeSession) {
      activeSession = Date.now().toString();
      setCurrentSessionId(activeSession);
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Also push user message to sessions immediately in case user navigates away
    setSessions(prev => {
      const exists = prev.find(s => s.id === activeSession);
      if (exists) {
        return prev.map(s => s.id === activeSession ? { ...s, lastTime: Date.now(), messages: [...s.messages, userMessage] } : s);
      } else {
        return [{ id: activeSession!, title: userMessage.content, lastTime: Date.now(), messages: [userMessage] }, ...prev];
      }
    });

    setInput('');
    setLoading(true);

    // Scroll to bottom immediately so user sees their message and the thinking indicator
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

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
          attached_ml_tests: attachedTestsData,
          current_weather: weather // Inject rich weather data (current, forecast, seasonal) for AI
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

        const currentActiveSession = useAppStore.getState().testStates['chat']?.currentSessionId;

        // Only update active messages if the user hasn't switched conversations
        if (currentActiveSession === activeSession) {
          const scrollArea = chatScrollAreaRef.current;
          const currentScrollTop = scrollArea ? scrollArea.scrollTop : 0;

          setMessages(prev => [...prev, assistantMessage]);

          // Defeat browser scroll anchoring so user viewport isn't yanked down
          if (scrollArea) {
            setTimeout(() => {
              scrollArea.scrollTop = currentScrollTop;
            }, 0);
          }
        }

        const dbEntry = {
          user_id: user?.id,
          session_id: activeSession,
          user_query: userMessage.content,
          ai_response: assistantMessage.content,
          language: language,
          created_at: new Date().toISOString()
        };

        if (user && !isDemoMode) {
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
          } catch (e) { }
        }

        // Always append AI response to the session history array so it's there if they switch back
        setSessions(prev => {
          const exists = prev.find(s => s.id === activeSession);
          if (exists) {
            return prev.map(s => s.id === activeSession ? { ...s, lastTime: Date.now(), messages: [...s.messages, assistantMessage] } : s);
          }
          return prev;
        });
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't process that request at the moment. Please try again.",
        timestamp: new Date()
      };

      const currentActiveSession = useAppStore.getState().testStates['chat']?.currentSessionId;
      if (currentActiveSession === activeSession) {
        setMessages(prev => [...prev, errorMsg]);
      }

      setSessions(prev => {
        const exists = prev.find(s => s.id === activeSession);
        if (exists) {
          return prev.map(s => s.id === activeSession ? { ...s, lastTime: Date.now(), messages: [...s.messages, errorMsg] } : s);
        }
        return prev;
      });
    } finally {
      // Only clear loading state if we are still on the same session
      const currentActiveSession = useAppStore.getState().testStates['chat']?.currentSessionId;
      if (currentActiveSession === activeSession) {
        setLoading(false);
      }
    }
  };

  const getTestLabel = (test: any) => {
    const timeStr = new Date(test.created_at).toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
    if (test.test_type === 'disease_detection') {
      return `🦠 Disease: ${test.result_data?.disease || 'Scan'} (${timeStr})`;
    }
    if (test.test_type === 'ndvi_analysis') {
      return `🛰️ NDVI Score: ${test.result_data?.ndvi_score || 'Unknown'} (${timeStr})`;
    }
    if (test.test_type === 'crop_recommendation') {
      const crops = test.result_data?.recommended_crops;
      const topCrops = crops ? crops.slice(0, 3).map((c: any) => c.crop).join(', ') : 'Unknown';
      return `🌱 Crop Rec: ${topCrops} (${timeStr})`;
    }
    return `Test Data (${timeStr})`;
  };

  return (
    <div className={styles.pageContainer}>
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar for History */}
      <div className={`${styles.sidebar} ${showMobileSidebar ? styles.sidebarMobileVisible : ''}`}>
        <div className="p-4 border-b border-earth-100 flex items-center justify-between">
          <h2 className="text-earth-900 font-bold flex items-center gap-2">
            <MessageSquare size={18} className="text-primary-600" /> Chats
          </h2>
          <div className="flex items-center gap-2">
            {!user && <span className="text-[10px] bg-accent-500 text-white px-2 py-0.5 rounded uppercase font-bold">Demo</span>}
            <button className="md:hidden text-earth-500 hover:text-earth-800" onClick={() => setShowMobileSidebar(false)}>
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-3">
          <button onClick={startNewChat} className={styles.newChatBtn}>
            <Plus size={18} /> New Chat
          </button>
        </div>
        <div className={styles.sessionList}>
          {loadingDb ? (
            <div className="flex flex-col gap-2 mt-2 px-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-earth-100 rounded-lg animate-pulse w-full"></div>
              ))}
            </div>
          ) : (
            <>
              {sessions.map(sess => (
                <button
                  key={sess.id}
                  onClick={() => {
                    loadSession(sess);
                    setShowMobileSidebar(false);
                  }}
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
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={styles.mainChat}>
        <header className={styles.header}>
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-earth-600 p-1.5 hover:bg-earth-100 rounded-lg transition-colors"
              onClick={() => setShowMobileSidebar(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className={styles.title}>
              <MessageCircle className={styles.titleIcon} /> AgriSage AI
            </h1>
          </div>
        </header>

        {/* Chat Messages */}
        <div className={styles.chatScrollArea} ref={chatScrollAreaRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.msgWrapperBase} ${msg.role === 'user' ? styles.msgWrapperUser : styles.msgWrapperAssistant}`}>
              <div className={`${styles.avatarBase} ${msg.role === 'user' ? styles.avatarUser : styles.avatarAssistant}`}>
                {msg.role === 'user' ? <User size={16} /> : <Sprout size={20} />}
              </div>
              <div className={`${styles.bubbleBase} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                {msg.role === 'assistant' ? (
                  <div className="prose max-w-none text-left text-[16px] md:text-[17px] leading-relaxed text-earth-900 prose-p:my-2 prose-headings:text-primary-900 prose-strong:text-primary-800">
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
                <Sprout size={20} />
              </div>
              <div className={`${styles.bubbleBase} ${styles.bubbleAssistant} flex flex-col gap-3 min-w-[200px]`}>
                <div className="flex gap-1.5 items-center px-1 pt-1">
                  <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce"></div>
                </div>
                <span className="text-primary-600 font-bold animate-pulse text-xs uppercase tracking-widest">AgriSage is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area & Context Selection */}
        <div className={styles.inputContainer}>
          <div className="flex flex-col gap-3 w-full">

            {/* Context Selection Panel */}
            {mlTests.length > 0 && (
              <div className="flex flex-col gap-2 w-full relative" ref={contextBoxRef}>
                <button
                  onClick={() => setShowContextBox(!showContextBox)}
                  className="self-start text-xs font-semibold text-primary-700 bg-primary-50 px-4 py-2 rounded-full border border-primary-200 hover:bg-primary-100 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Database size={16} />
                  {selectedTests.length > 0 ? `${selectedTests.length} Items Attached` : "Attach Farm Context"}
                </button>

                {showContextBox && (
                  <div className="absolute bottom-full mb-2 left-0 w-full md:w-[28rem] bg-white border border-earth-200 rounded-xl shadow-2xl p-4 max-h-72 overflow-y-auto z-50 animate-fade-in-up">
                    <div className="flex items-center justify-between border-b border-earth-100 pb-2 mb-3">
                      <h3 className="text-sm font-bold text-earth-800">Select Recent Tests</h3>
                      <button onClick={() => setShowContextBox(false)} className="text-earth-400 hover:text-earth-700 font-bold text-lg">&times;</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {mlTests.map(test => (
                        <button
                          key={test.id}
                          onClick={() => setSelectedTests(prev => prev.includes(test.id) ? prev.filter(id => id !== test.id) : [...prev, test.id])}
                          className={`p-3 rounded-lg text-sm text-left transition-all duration-200 border ${selectedTests.includes(test.id)
                            ? 'bg-primary-50 border-primary-400 font-medium shadow-sm'
                            : 'bg-earth-50 border-transparent hover:bg-earth-100 hover:border-earth-300 text-earth-700'
                            }`}
                        >
                          {getTestLabel(test)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
    </div>
  );
};

export default ChatPage;
