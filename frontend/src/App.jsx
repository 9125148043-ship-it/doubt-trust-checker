import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import "./App.css";

function prepareMarkdown(text) {
  return text
    .replace(
      /\\\[\s*([\s\S]*?)\s*\\\]/g,
      (_, formula) => `$$${formula.trim()}$$`
    )
    .replace(
      /(?<!\$)\[\s*([\s\S]*?\\(?:frac|times|div|sqrt|cdot)[\s\S]*?)\s*\](?!\$)/g,
      (_, formula) => `$$${formula.trim()}$$`
    );
}

const STORAGE_KEY = "verifed_chats";

const starterExamples = [
  "Why does the sky appear blue during the day?",
  "Why do objects fall toward Earth?",
  "How does photosynthesis work?",
];

function createChat() {
  return {
    id: Date.now().toString(),
    title: "New chat",
    messages: [],
  };
}

function makeTitle(text) {
  const clean = text.trim().replace(/\s+/g, " ");

  if (clean.length <= 32) {
    return clean || "New chat";
  }

  return `${clean.slice(0, 32)}...`;
}

function App() {
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore invalid local storage.
    }

    return [createChat()];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
    } catch {
      // Ignore invalid local storage.
    }

    return null;
  });

  const [input, setInput] = useState("");
  
const [openMenu, setOpenMenu] = useState(null);

useEffect(() => {
  const closeMenu = () => {
    setOpenMenu(null);
  };

  document.addEventListener("click", closeMenu);

  return () => {
    document.removeEventListener("click", closeMenu);
  };
}, []);

  const [loading, setLoading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [studyMaterialOpen, setStudyMaterialOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [imageQuery, setImageQuery] = useState("");
  const [searchedImageQuery, setSearchedImageQuery] = useState("");
  const [searchedImages, setSearchedImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [savedImages, setSavedImages] = useState(
  () => JSON.parse(localStorage.getItem("doubt-trust-saved-images") || "[]")
);
  const [noteText, setNoteText] = useState(
  () => localStorage.getItem("doubt-trust-notes") || ""
);

  useEffect(() => {
  localStorage.setItem("doubt-trust-notes", noteText);
}, [noteText]);

  useEffect(() => {
  localStorage.setItem(
    "doubt-trust-saved-images",
    JSON.stringify(savedImages)
  );
}, [savedImages]);

  const [showScrollDown, setShowScrollDown] = useState(false);
  const conversationRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) || chats[0];

  useEffect(() => {
    setLoading(false);
   }, [activeChatId]);


useEffect(() => {
  const conversation = conversationRef.current;

  if (!conversation) return;

  const handleScroll = () => {
    const distanceFromBottom =
      conversation.scrollHeight -
      conversation.scrollTop -
      conversation.clientHeight;

    setShowScrollDown(distanceFromBottom > 150);
  };

  conversation.addEventListener("scroll", handleScroll);
  handleScroll();

  return () => {
    conversation.removeEventListener("scroll", handleScroll);
  };

 }, [activeChatId]);


  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [activeChat?.messages, loading]);

  const createNewChat = () => {
    const newChat = createChat();

    setChats((current) => [newChat, ...current]);
    setActiveChatId(newChat.id);
    setInput("");
    setSidebarOpen(false);
  };

  const selectChat = (id) => {
    setActiveChatId(id);
    setSidebarOpen(false);
  };

  const updateChatMessages = (chatId, messages) => {
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages,
            }
          : chat
      )
    );
  };

  const checkDoubt = async (question = input) => {
    const doubt = question.trim();

    if (!doubt || loading) {
      return;
    }

    let chat = activeChat;

    if (!chat) {
      chat = createChat();
      setChats((current) => [chat, ...current]);
      setActiveChatId(chat.id);
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: doubt,
    };

    const updatedMessages = [...chat.messages, userMessage];

    setChats((current) =>
      current.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              title:
                item.messages.length === 0
                  ? makeTitle(doubt)
                  : item.title,
              messages: updatedMessages,
            }
          : item
      )
    );

    setInput("");
    setLoading(true);
    setImagesLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(
        "http://127.0.0.1:8000/check-doubt",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
  		doubt,
  		history: chat.messages,
	  }),
          signal: controller.signal,
        }
      );
 
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = await response.json();

      const answerText =
        typeof data?.answer === "object"
          ? data.answer?.answer
          : data?.answer;

      const refinedAnswer =
        data?.refinement?.refined_answer || answerText;

      const assistantMessage = {
         id: `${Date.now()}-assistant`,
         role: "assistant",
         content: refinedAnswer || "No answer was returned.",
         result: data,
         followUpOptions: data?.follow_up_options || [],
      };

      updateChatMessages(chat.id, [
        ...updatedMessages,
        assistantMessage,
      ]);
    } catch {
      const errorMessage = {
        id: `${Date.now()}-error`,
        role: "assistant",
        content:
          "I couldn't reach VerifiEd right now. Please make sure the backend is running.",
        error: true,
      };

      updateChatMessages(chat.id, [
        ...updatedMessages,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      checkDoubt();
    }
  };

  const deleteChat = (event, chatId) => {
    event.stopPropagation();

    setChats((current) => {
      const remaining = current.filter((chat) => chat.id !== chatId);

      if (remaining.length === 0) {
        const replacement = createChat();
        setActiveChatId(replacement.id);
        return [replacement];
      }

      if (chatId === activeChatId) {
        setActiveChatId(remaining[0].id);
      }

      return remaining;
    });
  };

 return (
  <div className="verifed-app">
    <div
      className="verifed-background-overlay"
      aria-hidden="true"
    />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-mark">V</div>
            <span>VerifiEd</span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <button className="new-chat-button" onClick={createNewChat}>
          <span className="plus">+</span>
          New chat
        </button>

        <div className="sidebar-section">
          <div className="sidebar-label">Chats</div>

          <div className="chat-history">
            {chats.map((chat) => (
              <button
                key={chat.id}
                className={`chat-history-item ${
                  chat.id === activeChatId ? "active" : ""
                }`}
                onClick={() => selectChat(chat.id)}
              >
                <span className="chat-icon">◌</span>

                <span className="chat-title">
                  {chat.title}
                </span>

                <span
                  className="delete-chat"
                  onClick={(event) => deleteChat(event, chat.id)}
                  title="Delete chat"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>

       
<div className="sidebar-bottom">
  <button
    className="sidebar-tool"
    onClick={() => setLibraryOpen(true)}
  >
    <span>▤</span>
    Library
  </button>

  <button
  className="sidebar-tool"
  onClick={() => setImagesOpen(true)}
>
  <span>▧</span>
  Images
</button>

  <div className="sidebar-divider"></div>

  <div className="ai-status">
    <span className="status-dot"></span>

    <div>
      <strong>Verification when needed</strong>
      <small>Generate · Verify when needed</small>
    </div>
  </div>
</div>      </aside>

      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}


      {libraryOpen && (
  <div className="library-panel">
    <div className="library-header">
      <h2>Library</h2>

      <button
        className="library-close"
        onClick={() => {
  setLibraryOpen(false);
  setNotesOpen(true);
}}
      >
        ×
      </button>
    </div>

    <div className="library-content">
  <div className="library-intro">
    <h3>Your study library</h3>
    <p>Keep useful conversations and learning material in one place.</p>
  </div>

  <div className="library-grid">
    <button
  className="library-card"
  onClick={() => {
    setLibraryOpen(false);
    setSidebarOpen(true);
  }}
>
  <span className="library-card-icon">▤</span>
  <strong>Saved chats</strong>
  <small>Keep important explanations</small>
</button>

    <button
  className="library-card"
  onClick={() => {
  setLibraryOpen(false);
  setNotesOpen(true);
}}
>
  <span className="library-card-icon">✎</span>
  <strong>Notes</strong>
  <small>Store your study notes</small>
</button>

    <button
  className="library-card"
  onClick={() => {
    setLibraryOpen(false);
    setStudyMaterialOpen(true);
  }}
>
  <span className="library-card-icon">▧</span>
  <strong>Study material</strong>
  <small>Organize useful resources</small>
</button>
  </div>
</div>
  </div>
)}
  
     {notesOpen && (
  <div className="notes-panel">
    <div className="notes-header">
      <div>
  <h2>Notes</h2>
  <small className="notes-saved">Saved automatically</small>
</div>

      <button
        className="notes-close"
        onClick={() => setNotesOpen(false)}
      >
        ×
      </button>
    </div>

    <div className="notes-content">
      <textarea
        className="notes-editor"
        placeholder="Write your study notes here..."
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
       />
    </div>
  </div>
)}

     {studyMaterialOpen && (
  <div className="study-material-panel">
    <div className="study-material-header">
      <div>
        <h2>Study material</h2>
        <small>Keep useful learning resources here.</small>
      </div>

      <button
        className="study-material-close"
        onClick={() => setStudyMaterialOpen(false)}
      >
        ×
      </button>
    </div>

    <div className="study-material-empty">
      <div className="study-material-icon">▧</div>
      <h3>No study material yet</h3>
      <p>Files and learning resources you add will appear here.</p>
    </div>
  </div>
)}

     {imagesOpen && (
  <div className="images-panel">
    <div className="images-header">
      <div>
        <h2>Images</h2>
        <small>Find visual resources for your learning.</small>
      </div>

      <button
        className="images-close"
        onClick={() => setImagesOpen(false)}
      >
        ×
      </button>
    </div>

    <div className="images-search">
  <input
  type="text"
  placeholder="Search for an image..."
  value={imageQuery}
  onChange={(e) => setImageQuery(e.target.value)}
/>
  <button
  disabled={imagesLoading}
  onClick={async () => {
  const query = imageQuery.trim();

  if (!query) return;

  setSearchedImageQuery(query);

  setImagesLoading(true);

  try {
    const response = await fetch(
      `http://127.0.0.1:8000/search-images?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    setSearchedImages(data.images || []);
    setImagesLoading(false);
  } catch (error) {
    console.error("Image search failed:", error);
    setSearchedImages([]);
    setImagesLoading(false);
  }
}}
>
  Search
</button>
</div>

    {savedImages.length > 0 && (
  <div className="saved-images-section">
    <div className="saved-images-header">
      <h3>Saved images</h3>
      <small>{savedImages.length} saved</small>
    </div>

    <div className="saved-images-grid">
  {savedImages.map((image, index) => (
    <a
      key={`${image.image_url}-${index}`}
      className="image-card"
      href={image.source_url}
      target="_blank"
      rel="noreferrer"
    >
      <img
        src={image.image_url}
        alt={image.title || "Saved image"}
      />

      <div className="image-card-info">
        <strong>{image.title || "Untitled image"}</strong>
        <small>{image.source || "Source"}</small>

        <button
          className="remove-image-button"
          onClick={(event) => {
            event.preventDefault();

            setSavedImages((current) =>
              current.filter(
                (saved) => saved.image_url !== image.image_url
              )
            );
          }}
        >
          Remove
        </button>
      </div>
    </a>
  ))}
</div>
</div>
)}

    {imagesLoading ? (
  <div className="images-empty">
    <div className="images-icon">◌</div>
    <h3>Searching...</h3>
    <p>Finding relevant images for you.</p>
  </div>
) : searchedImages.length > 0 ? (
  <div className="images-grid">
    {searchedImages.map((image, index) => (
      <a
        key={`${image.image_url}-${index}`}
        className="image-card"
        href={image.source_url}
        target="_blank"
        rel="noreferrer"
      >
        <img
          src={image.image_url}
          alt={image.title || "Search result"}
        />

        <div className="image-card-info">
  <strong>{image.title || "Untitled image"}</strong>
  <small>{image.source || "Source"}</small>

  <button
    className="save-image-button"
    onClick={(event) => {
      event.preventDefault();

      setSavedImages((current) => {
        const alreadySaved = current.some(
          (saved) => saved.image_url === image.image_url
        );

        if (alreadySaved) {
          return current;
        }

        return [...current, image];
      });
    }}
  >
    {savedImages.some(
      (saved) => saved.image_url === image.image_url
    )
      ? "Saved"
      : "Save image"}
  </button>
</div>
      </a>
    ))}
  </div>
) : (
  <div className="images-empty">
    <div className="images-icon">▧</div>
    <h3>
      {searchedImageQuery
        ? "No images found"
        : "No images yet"}
    </h3>
    <p>
      {searchedImageQuery
        ? `Try another search for "${searchedImageQuery}".`
        : "Relevant images will appear here when you search for them."}
    </p>
  </div>
)}
  </div>
)}

      <main className="chat-area">
        <header className="chat-header">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div>
            <span className="chat-header-title">
              {activeChat?.title || "New chat"}
            </span>

            <span className="chat-header-subtitle">
              VerifiEd verification
            </span>
          </div>

          <button
            className="header-new-chat"
            onClick={createNewChat}
          >
            + New chat
          </button>
        </header>

        <div className="messages-container" ref={conversationRef}>
          {activeChat?.messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-mark">V</div>

              <h1>
                Answers you can <span>weigh</span>.
              </h1>

              <p>
                Ask anything. VerifiEd generates an answer,
                evaluates it, refines it, and gives you a
                reliability signal.
              </p>

              <div className="example-grid">
                {starterExamples.map((example) => (
                  <button
                    key={example}
                    onClick={() => checkDoubt(example)}
                  >
                    <span>Ask</span>
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="conversation" ref={conversationRef}>
              {activeChat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`message-row ${message.role}`}
                >
                  
                  <div className="message-content">
                    <div className="message-name">
                      {message.role === "user"
                        ? "You"
                        : "VerifiEd"}
                    </div>

                    <div
  		        className={`message-text ${
    			   message.error ? "message-error" : ""
  			}`}
		    >
  			{message.error ? (
    			   message.content
  			) : (
    			   <ReactMarkdown
      				remarkPlugins={[remarkGfm, remarkMath]}
      				rehypePlugins={[rehypeKatex, rehypeHighlight]}
    		    >
      				{prepareMarkdown(message.content)}
    			   </ReactMarkdown>
  		    )}
                  </div>

                    {message.role === "assistant" &&
  			message.result?.verification_performed && (
                        <VerificationResult
                          result={message.result}
                        />
                      )}
                   
                    {message.role === "assistant" &&
                       !message.error &&
                      message.followUpOptions?.length > 0 && (
                        <div className="follow-up-options">
                          {message.followUpOptions.map((option) => (
                             <button
                               key={option}
                               onClick={() => checkDoubt(option)}
                             >
                               {option}
                             </button>
                           ))}
                         </div>
                       )}
                  
                
                 {message.role === "assistant" && !message.error && (
  <div className="message-actions">
    <button
  onClick={() =>
    navigator.clipboard.writeText(message.content)
  }
  title="Copy"
  aria-label="Copy"
>
  <svg viewBox="0 0 24 24" aria-hidden="true">
  <rect x="9" y="9" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
  <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
</svg>
</button>

<button
  onClick={() => {
    if (navigator.share) {
      navigator.share({
        text: message.content,
      });
    } else {
      navigator.clipboard.writeText(message.content);
    }
  }}
  title="Share"
  aria-label="Share"
>
  <svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 16V4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  <path d="M8 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
</svg>
</button>

<button
  onClick={() => checkDoubt(message.content)}
  title="Retry"
  aria-label="Retry"
>
  <svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M20 11a8 8 0 0 0-14.9-3.8L3 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  <path d="M3 5v5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  <path d="M4 13a8 8 0 0 0 14.9 3.8L21 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  <path d="M21 19v-5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
</svg>
</button>

<button
  title="More options"
  aria-label="More options"
  onClick={(event) => {
    event.stopPropagation();
    setOpenMenu(
      openMenu === message.id ? null : message.id
    );
  }}
>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
  </svg>
</button>{openMenu === message.id && (
  <div className="more-menu">
    <button
      onClick={() => {
        navigator.clipboard.writeText(message.content);
        setOpenMenu(null);
      }}
    >
      Copy response
    </button>

    <button
      onClick={() => {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(
            new SpeechSynthesisUtterance(message.content)
          );
        }
        setOpenMenu(null);
      }}
    >
      Read aloud
    </button>

    <button
      onClick={() => {
        checkDoubt(message.content);
        setOpenMenu(null);
      }}
    >
      Retry response
    </button>
  </div>
)}
  </div>
)}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-row assistant">
                  
                  <div className="message-content">
                    <div className="message-name">VerifiEd</div>

                    <div className="thinking">
                      <span></span>
                      <span></span>
                      <span></span>
                      <em>Thinking...</em>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
       
        {showScrollDown && (
  <button
    className="scroll-down-button"
    onClick={() => {
      conversationRef.current?.scrollTo({
        top: conversationRef.current.scrollHeight,
        behavior: "smooth",
      });
    }}
    aria-label="Scroll to latest message"
  >
    ↓
  </button>
)}
        <div className="composer-area">
          <div className="composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message VerifiEd..."
              rows={1}
              disabled={loading}
            />

            <button
              className="send-button"
              onClick={() => checkDoubt()}
              disabled={!input.trim() || loading}
            >
              ↑
            </button>
          </div>

          <div className="composer-note">
            VerifiEd can make mistakes. Check important information.
          </div>
        </div>
      </main>
    </div>
  );
}

function VerificationResult({ result }) {
  const answerScore =
    result?.trust_score ?? result?.evaluation?.score ?? 0;

  return (
    <div className="verification-result">
      <div className="verification-top">
        <div>
          <span className="verification-label">
            RELIABILITY
          </span>

          <div className="verification-score">
            {answerScore}
            <small>/100</small>
          </div>

          <strong className="trust-label">
            {result?.trust_label || "Evaluated"}
          </strong>
        </div>

        <div
          className="mini-score-ring"
          style={{
            "--score": `${answerScore * 3.6}deg`,
          }}
        >
          <div>{answerScore}</div>
        </div>
      </div>

      {result?.suggested_action && (
        <div className="suggested-action">
          <span>Suggested action</span>
          {result.suggested_action}
        </div>
      )}

      <div className="evaluation-grid">
        <div>
          <span>FIRST EVALUATION</span>
          <strong>
            {result?.evaluation?.score ?? "—"}
            <small>/100</small>
          </strong>
        </div>

        <div>
          <span>INDEPENDENT CHECK</span>
          <strong>
            {result?.second_evaluation?.score ?? "—"}
            <small>/100</small>
          </strong>
        </div>
      </div>

      <details className="verification-details">
        <summary>View verification details</summary>

        <div className="details-content">
          <p>
            The answer was evaluated, refined, and independently
            checked before the final reliability signal was
            produced.
          </p>

          <div className="telemetry">
            <span>
              AI calls:{" "}
              {result?.telemetry?.model_calls_made ?? 0}
            </span>

            <span>
              Processing:{" "}
              {result?.telemetry?.total_latency_ms ?? 0} ms
            </span>
          </div>
        </div>
      </details>
    </div>
  );
}

export default App;