import { useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../App';
import './DatabaseView.css';

const API_DOCS_URL = process.env.REACT_APP_API_DOCS_URL

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  '.md',
  '.markdown',
  'text/markdown',
  'text/x-markdown',
  'application/x-markdown'
];

const formatDateToBR = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    return formatter.format(date);
  } catch (error) {
    console.error('Erro ao formatar data:', dateString, error);
    return dateString || '-'; 
  }
};

const capitalize = (s) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

function DatabaseView() {
  const { tokens, logout } = useContext(AuthContext);
  const accessToken = tokens?.accessToken;

  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [currentDocument, setCurrentDocument] = useState(null);

  const [updateFile, setUpdateFile] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [updating, setUpdating] = useState(false);

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState('');

  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const handleAxiosError = (err, defaultMsg) => {
    console.error(defaultMsg, err);
    if (err.response?.status === 401) {
      logout();
    } else {
      setError(defaultMsg);
    }
  };

  const loadDocuments = useCallback(async (pageNum = page, pageSize = size, { silent = false } = {}) => {
    try {
      if (!silent) {
        setLoadingDocs(true);
        setError('');
      }

      const response = await axios.get(
        `${API_DOCS_URL}/api/v1/Documents/list_documents`,
        {
          headers: authHeader,
          params: { page: pageNum, size: pageSize },
        }
      );

      const data = response.data || {};
      const incomingDocs = data.documents || data.items || [];
      const newTotalPages = data.total_pages || data.totalPages || 1;

      if (pageNum === page) {
        const incomingMap = new Map(
            incomingDocs.map(d => [d.document_id || d.id, d])
        );

        setDocuments(prevDocs => {
          if (incomingDocs.length !== prevDocs.length || !silent) {
            return incomingDocs;
          }

          const updatedDocs = prevDocs.map(doc => {
              const id = doc.document_id || doc.id;
              const incoming = incomingMap.get(id);
              return incoming ? { ...doc, ...incoming } : doc;
          });
          return updatedDocs;
        });

      } else {
        setDocuments(incomingDocs);
      }

      setTotalPages(newTotalPages);
      setPage(pageNum);
      setSize(pageSize);
    } catch (err) {
      if (!silent) {
        handleAxiosError(err, 'Erro ao carregar documentos.');
      } else {
        if (err.response?.status === 401) {
             logout();
        } else {
            console.error('Erro ao atualizar documentos via polling:', err);
        }
      }
    } finally {
      if (!silent) {
        setLoadingDocs(false);
      }
    }
  }, [page, size, accessToken, API_DOCS_URL, logout]); 
  
  const validateFile = (file) => {
    
    if (!file) return 'Selecione um arquivo.';
    const fileName = file.name ? file.name.toLowerCase() : '';
    const isMarkdownExtension = fileName.endsWith('.md') || fileName.endsWith('.markdown');

    if (!ALLOWED_MIME_TYPES.includes(file.type) && !isMarkdownExtension) {
      return `Tipo de arquivo não permitido (${file.type}). Permitidos: ${ALLOWED_MIME_TYPES.join(', ')}`;
    }
    setUploadError(''); 
    return '';
  };

  const handleUploadFileChange = (e) => {
    const file = e.target.files?.[0];
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      setUploadFile(null);
    } else {
      setUploadError('');
      setUploadFile(file);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Selecione um arquivo válido.');
      return;
    }

    try {
      setUploading(true);
      setUploadError('');
      setError('');
      setCurrentDocument(null);

      const formData = new FormData();
      formData.append('file', uploadFile);

      const ingestResponse = await axios.post(
        `${API_DOCS_URL}/api/v1/Documents/ingest_document`,
        formData,
        {
          headers: {
            ...authHeader,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const documentId = ingestResponse.data.document_id || 
                         ingestResponse.data.id || 
                         ingestResponse.data.Document?.id;

      if (!documentId) {
        console.warn('⚠️ Resposta do backend não contém ID do documento:', ingestResponse.data);
        throw new Error('Resposta do backend não contém ID do documento');
      }

      const consultResponse = await axios.get(
        `${API_DOCS_URL}/api/v1/Documents/consult_document?document_id=${documentId}`,
        {
          headers: {
            ...authHeader,
            'Accept': 'application/json',
          },
        }
      );

      setCurrentDocument(consultResponse.data);

      setUploadFile(null);
      e.target.reset();
      loadDocuments(page, size, { silent: false }); 
    } catch (err) {
      handleAxiosError(err, 'Erro ao fazer upload ou consultar documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateFileChange = (e) => {
    const file = e.target.files?.[0];
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setUpdateFile(null);
    } else {
      setError('');
      setUpdateFile(file);
    }
  };

  const handleUpdate = async (documentId) => {
    if (!updateFile) {
      setError('Selecione um arquivo para atualizar.');
      return;
    }

    try {
      setUpdating(true);
      setError('');

      const formData = new FormData();
      formData.append('document_id', documentId);
      formData.append('file', updateFile);

      await axios.put(
        `${API_DOCS_URL}/api/v1/Documents/update_document`,
        formData,
        {
          headers: {
            ...authHeader,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setUpdatingId(null);
      setUpdateFile(null);
      setCurrentDocument(null);
      loadDocuments(page, size, { silent: false });
    } catch (err) {
      handleAxiosError(err, 'Erro ao atualizar documento.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Deseja realmente excluir este documento?')) return;

    try {
      setError('');

      await axios.delete(
        `${API_DOCS_URL}/api/v1/Documents/delete_document?document_id=${documentId}`,
        {
          headers: {
            ...authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      setDocuments(prev =>
        prev.filter(doc => (doc.id || doc.document_id) !== documentId)
      );
      loadDocuments(page, size, { silent: false });
    } catch (err) {
      handleAxiosError(err, 'Erro ao excluir documento.');
    }
  };
  
  useEffect(() => {
    if (!accessToken) return;
    setCurrentDocument(null);
    loadDocuments(1, size, { silent: false });
  }, [accessToken, loadDocuments, size]); 

  useEffect(() => {
    if (!accessToken) return;

    const intervalId = setInterval(() => {
      loadDocuments(page, size, { silent: true }); 
    }, 5000);

    return () => clearInterval(intervalId);
  }, [loadDocuments, page, size, accessToken]); 

  return (
    <div className="database-page">
      <header className="database-header">
        <h2>Documentos indexados</h2>
        {/* 1. 🎯 CORRIGIDO: Chamar navigate(-1) dentro de uma função anônima para evitar loop de render */}
        <button className="btn logout" onClick={() => navigate(-1)}>
          Voltar
        </button>
      </header>

      <section className="upload-section">
        <h3>Upload de documento</h3>
        <form onSubmit={handleUpload} className="upload-form">
          <input
            type="file"
            onChange={handleUploadFileChange}
            accept={ALLOWED_MIME_TYPES.join(',')}
          />
          <button
            type="submit"
            className="btn primary"
            disabled={uploading || !uploadFile}
          >
            {uploading ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
        {uploadError && <p className="error-text">{uploadError}</p>}
      </section>

      <section className="documents-section">
        <div className="documents-header">
          <h3>Lista de documentos</h3>
          <div className="pagination-controls">
            <button
              className="btn"
              disabled={page <= 1}
              onClick={() => loadDocuments(page - 1, size, { silent: false })}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              className="btn"
              disabled={page >= totalPages}
              onClick={() => loadDocuments(page + 1, size, { silent: false })}
            >
              Próxima
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {loadingDocs && <p>Carregando documentos...</p>}

        {!loadingDocs && documents.length === 0 && (
          <p>Nenhum documento encontrado.</p>
        )}

        {!loadingDocs && documents.length > 0 && (
          <table className="documents-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Criado em</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id || doc.document_id}>
                  <td>{doc.document_name || doc.name || '-'}</td>
                  <td>{formatDateToBR(doc.created_at)}</td>
                  <td>
                    <span className={`status-badge status-${(doc.document_status || doc.status || 'unknown').toLowerCase()}`}>
                      {/* 2. 🎯 CORRIGIDO: Usando capitalize para manter a formatação correta */}
                      {capitalize(doc.document_status || doc.status || '-')}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn small"
                      type="button"
                      onClick={() =>
                        setUpdatingId(doc.id || doc.document_id)
                      }
                    >
                      Atualizar
                    </button>
                    <button
                      className="btn small danger"
                      type="button"
                      onClick={() =>
                        handleDelete(doc.id || doc.document_id)
                      }
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {updatingId && (
          <div className="update-panel">
            <h4>Atualizar documento {updatingId}</h4>
            <input
              type="file"
              onChange={handleUpdateFileChange}
              accept={ALLOWED_MIME_TYPES.join(',')}
            />
            <div className="update-actions">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setUpdatingId(null);
                  setUpdateFile(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={updating || !updateFile}
                onClick={() => handleUpdate(updatingId)}
              >
                {updating ? 'Atualizando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default DatabaseView;