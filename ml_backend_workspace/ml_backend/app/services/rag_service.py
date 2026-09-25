import os
import logging
from typing import List
from langchain_community.document_loaders import PyPDFDirectoryLoader, DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self):
        self.persist_directory = os.path.join(os.path.dirname(__file__), "..", "data", "chroma_db")
        self.docs_directory = os.path.join(os.path.dirname(__file__), "..", "data", "documents")
        
        # Ensure directories exist
        os.makedirs(self.persist_directory, exist_ok=True)
        os.makedirs(self.docs_directory, exist_ok=True)
        
        # Using a small, fast local embedding model
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.vectorstore = None
        
        try:
            # Try to load existing db
            self.vectorstore = Chroma(
                persist_directory=self.persist_directory, 
                embedding_function=self.embeddings
            )
        except Exception as e:
            logger.warning(f"Could not load existing vector DB: {e}")

    def index_documents(self):
        """Loads PDFs from the docs directory, splits them, and indexes into ChromaDB."""
        logger.info(f"Loading documents from {self.docs_directory}")
        pdf_loader = PyPDFDirectoryLoader(self.docs_directory)
        documents = pdf_loader.load()
        
        txt_loader = DirectoryLoader(self.docs_directory, glob="**/*.txt", loader_cls=TextLoader, loader_kwargs={'encoding': 'utf-8'})
        try:
            documents.extend(txt_loader.load())
        except Exception as e:
            logger.warning(f"Could not load txt files: {e}")
        
        if not documents:
            logger.warning("No documents found to index.")
            return False
            
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        
        logger.info(f"Indexing {len(chunks)} chunks into ChromaDB...")
        self.vectorstore = Chroma.from_documents(
            documents=chunks, 
            embedding=self.embeddings, 
            persist_directory=self.persist_directory
        )
        return True

    def retrieve_context(self, query: str, k: int = 3) -> str:
        """Retrieves top-k relevant context for a given query."""
        if not self.vectorstore:
            return ""
            
        try:
            docs = self.vectorstore.similarity_search(query, k=k)
            context = "\n\n".join([d.page_content for d in docs])
            return context
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return ""

rag_service = RAGService()
