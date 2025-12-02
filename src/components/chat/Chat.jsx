import { useContext, useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../App';
import './Chat.css';

const API_AUTH_URL = process.env.REACT_APP_API_CHAT_URL;

function Chat() {
  const { tokens, logout } = useContext(AuthContext);
  const accessToken = tokens?.accessToken;

  const navigate = useNavigate();

  const [histories, setHistories] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const [loadingHistories, setLoadingHistories] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const authHeader = { Authorization: `Bearer ${accessToken}` };
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Carrega apenas a lista de históricos, sem selecionar conversa
  const loadUserHistories = async () => {
    try {
      setLoadingHistories(true);
      setError('');

      const response = await axios.get(
        `${API_AUTH_URL}/api/v1/Chat/history`,
        {
          headers: authHeader,
          params: { limit: 20 },
        }
      );

      const list = response.data?.conversations || [];
      setHistories(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Erro ao carregar históricos:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Erro ao carregar históricos.');
      }
    } finally {
      setLoadingHistories(false);
    }
  };

  // Carrega mensagens de uma conversa específica
  const loadConversationMessages = async (conversationId) => {
    if (!conversationId) return;
    try {
      setLoadingMessages(true);
      setError('');

      const response = await axios.get(
        `${API_AUTH_URL}/api/v1/Chat/history/${conversationId}`,
        {
          headers: authHeader,
          params: { limit: 50 },
        }
      );

      const msgs = response.data?.messages || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
      scrollToBottom();
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Erro ao carregar mensagens desta conversa.');
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  // Envia nova mensagem (usa response do backend)
  const handleSendMessage = async (e) => {
    e.preventDefault();

    // ⚠️ GARANTE QUE O BOTÃO NÃO FIQUE TRAVADO SE 'sending' ESTIVER EM TRUE
    if (sending) return;

    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    const wasNewConversation = !selectedConversationId; // flag antes do POST

    const userMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setNewMessage('');
    scrollToBottom();

    try {
      setSending(true);
      setError('');

      const body = {
        message: content,
        conversation_id: selectedConversationId || null,
      };

      const resp = await axios.post(
        `${API_AUTH_URL}/api/v1/Chat/message`,
        body,
        {
          headers: { ...authHeader, 'Content-Type': 'application/json' },
        }
      );

      const data = resp.data;
      console.log('Resposta da API no handleSendMessage (Verificar convId):', data);

      // garante um conversation_id válido vindo da API
      const convId = data?.conversation_id;
      if (!convId) {
        console.warn('Resposta sem conversation_id, não atualizando histórico');
      } else {
        // ✅ 1. atualiza seleção SEMPRE que tiver convId
        setSelectedConversationId(convId);

        // ✅ 2. se era nova conversa antes do POST, adiciona novo histórico
        if (wasNewConversation) {
          setHistories((prev) => {
            const exists = prev.some((h) => h.conversation_id === convId);
            if (exists) return prev;

            const newHistory = {
              conversation_id: convId,
              // MODIFICAÇÃO: Adicionando fallback para o título aqui
              title: data.title || 'Nova Conversa',
            };

            // Adiciona no início da lista para visualização imediata
            return [newHistory, ...prev];
          });
        }
      }

      const assistantMessage = {
        id: `assistant-${data.timestamp || Date.now()}`,
        role: data.role || 'assistant',
        content: data.response,
        timestamp: data.timestamp,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      scrollToBottom();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);

      setMessages((prev) =>
        prev.filter((m) => !String(m.id).startsWith('local-user-'))
      );

      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Erro ao enviar mensagem.');
      }
    } finally {
      setSending(false); // <--- O estado 'sending' é desativado aqui (crucial!)
    }
  };


  const handleNewConversation = () => {
    setSelectedConversationId(null); // nada selecionado
    setMessages([]);
    setNewMessage('');
    setError('');
  };

  // carrega somente a lista de históricos ao entrar
  useEffect(() => {
    if (accessToken) {
      loadUserHistories();
    }
  }, [accessToken]);

  // quando o usuário selecionar um histórico, carrega as mensagens
  useEffect(() => {
    if (accessToken && selectedConversationId) {
      loadConversationMessages(selectedConversationId);
    }
  }, [accessToken, selectedConversationId]);

  // Enter envia, Shift+Enter quebra linha
  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending && newMessage.trim()) {
        handleSendMessage(e);
      }
    }
  };

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <h2>Históricos</h2>
          <button onClick={logout} className="logout btn">Sair</button>
          <button
            className="btn"
            onClick={() => navigate('/database')}
          >
            Database
          </button>
        </div>

        <button className="new-chat btn" onClick={handleNewConversation}>
          + Nova Conversa
        </button>

        {loadingHistories && <p>Carregando históricos...</p>}

        {!loadingHistories && histories.length === 0 && (
          <p>Nenhuma conversa ainda.</p>
        )}

        <ul className="history-list">
          {Array.isArray(histories) &&
            histories.map((item) => {
              const id = item.conversation_id;
              return (
                <li
                  key={id}
                  className={
                    id === selectedConversationId
                      ? 'history-item selected'
                      : 'history-item'
                  }
                  onClick={() => {
                    setMessages([]); // limpa mensagens atuais
                    setSelectedConversationId(id);
                  }}
                >
                  <div className="history-title">
                    {/* MODIFICAÇÃO: Adicionando fallback para o título aqui */}
                    {item.title || 'Nova Conversa'}
                  </div>
                </li>
              );
            })}
        </ul>
      </aside>

      <main className="chat-main">
        <div className="chat-header">
          <h2>Chat</h2>
        </div>

        <div className="chat-messages">
          {loadingMessages && <p>Carregando mensagens...</p>}

          {!loadingMessages && messages.length === 0 && (
            <p>Comece uma nova conversa enviando uma mensagem.</p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-bubble ${msg.role === 'user' ? 'user' : 'assistant'
                }`}
            >
              <div className="message-role">{msg.role}</div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSendMessage}>
          {error && <div className="chat-error">{error}</div>}

          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={sending}
          />

          <button
            type="submit"
            className="send-button"
            disabled={sending || !newMessage.trim()}
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </main>
    </div>
  );
}

export default Chat;