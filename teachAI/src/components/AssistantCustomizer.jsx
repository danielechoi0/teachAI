import React, { useState, useRef, useEffect } from "react";
import { Plus, X, FileText, Trash2, Edit, AlertTriangle } from "lucide-react";
import { supabase } from "../utils/supabaseClient";

export default function AssistantCustomizer({ onBack, onSuccess, BACKEND_URL, showStatus }) {
  const [assistant, setAssistant] = useState({
    name: "",
    description: "",
    teacher_prompt: "",
    language: "English",
    first_message: "",
    levels: "",
    conversation_type: "strict"
  });

  const [kb_array, setKbArray] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [existingAssistants, setExistingAssistants] = useState([]);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const [isDeletingAssistant, setIsDeletingAssistant] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [viewMode, setViewMode] = useState('create');
  
  const [fileUploadForm, setFileUploadForm] = useState({
    file: null,
    name: "",
    description: "",
    showForm: false
  });
  
  const fileInputRef = useRef(null);

  const languageOptions = [
    { id: 'English', label: 'English', flag: '🇺🇸' },
    { id: 'Spanish', label: 'Spanish', flag: '🇪🇸' },
    { id: 'French', label: 'French', flag: '🇫🇷' },
    { id: 'Italian', label: 'Italian', flag: '🇮🇹' }
  ];

  const levelOptions = [
    { id: 'beginner', label: 'Beginner' },
    { id: 'intermediate', label: 'Intermediate' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'native', label: 'Native' }
  ];

  // Load existing assistants when component mounts or when switching to manage view
  useEffect(() => {
    if (viewMode === 'manage') {
      loadExistingAssistants();
    }
  }, [viewMode]);

  async function loadExistingAssistants() {
    setIsLoadingAssistants(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showStatus("Not authenticated. Please sign in again.", "error");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/teacher/assistants`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      if (response.ok) {
        const assistants = await response.json();
        setExistingAssistants(assistants);
      } else {
        const errorData = await response.json();
        showStatus(`Failed to load assistants: ${errorData.error || 'Unknown error'}`, "error");
      }
    } catch (error) {
      showStatus(`Error loading assistants: ${error.message}`, "error");
    } finally {
      setIsLoadingAssistants(false);
    }
  }

  async function handleDeleteAssistant(assistantId) {
    setIsDeletingAssistant(assistantId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showStatus("Not authenticated. Please sign in again.", "error");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/delete-assistant/${assistantId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      if (response.ok) {
        showStatus("Assistant deleted successfully!", "success");
        setExistingAssistants(prev => prev.filter(a => a.id !== assistantId));
        setShowDeleteConfirm(null);
      } else {
        const errorData = await response.json();
        showStatus(`Failed to delete assistant: ${errorData.error || 'Unknown error'}`, "error");
      }
    } catch (error) {
      showStatus(`Error deleting assistant: ${error.message}`, "error");
    } finally {
      setIsDeletingAssistant(null);
    }
  }

  function updateField(key, value) {
    setAssistant((prev) => ({ ...prev, [key]: value }));
  }

  function selectLevel(levelId) {
    setAssistant((prev) => ({
      ...prev,
      levels: prev.levels === levelId ? "" : levelId
    }));
  }

  // Drag and drop handlers
  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  function handleFileSelect(file) {
    if (!file) return;

    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'text/markdown',
      'application/json',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|md|json|csv|pdf|docx)$/i)) {
      showStatus("Unsupported file type. Please upload TXT, MD, JSON, CSV, PDF, or DOCX files.", "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showStatus("File too large. Please upload files smaller than 10MB.", "error");
      return;
    }

    // Set file and show form
    setFileUploadForm({
      file: file,
      name: file.name.replace(/\.[^/.]+$/, ""),
      description: "",
      showForm: true
    });
  }

  function handleFileInputChange(e) {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  // Upload file with name and description
  async function handleFileUpload() {
    if (!fileUploadForm.file || !fileUploadForm.name.trim()) {
      showStatus("Please provide a file and name", "error");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', fileUploadForm.file);
      formData.append('name', fileUploadForm.name.trim());
      formData.append('description', fileUploadForm.description.trim());

      const response = await fetch(`${BACKEND_URL}/upload-file`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        // Add to kb_array with file info
        const newKbItem = {
          ...result
        };
        
        setKbArray(prev => [...prev, newKbItem]);
        
        // Reset form
        setFileUploadForm({
          file: null,
          name: "",
          description: "",
          showForm: false
        });
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        showStatus("File uploaded successfully!", "success");
      } else {
        const errorData = await response.json();
        showStatus(`File upload failed: ${errorData.error || 'Unknown error'}`, "error");
      }
    } catch (error) {
      showStatus(`Upload error: ${error.message}`, "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  // Remove file from kb_array
  function removeKbFile(index) {
    setKbArray(prev => prev.filter((_, i) => i !== index));
  }

  // Cancel file upload form
  function cancelFileUpload() {
    setFileUploadForm({
      file: null,
      name: "",
      description: "",
      showForm: false
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Generate the appropriate prompt based on conversation type
  function generateSystemPrompt() {
    const language = assistant.language || "English";
    const level = assistant.levels || "intermediate";
    
    if (assistant.conversation_type === "strict") {
      return `[Identity]
You are giving a speaking assessment in this language: ${language}. Given this teacher_prompt: ${assistant.teacher_prompt} you will follow these instructions exactly.
The general structure of the call goes as so: You say the initial question that is given to you.
Then you ask the next given question exactly as given and so forth.

[Response Guideline]
-Given the questions you will ONLY ask these questions.
- Do not say anything else besides the questions word for word in order in which they are given,
- DO NOT answer if a student asks you a question

[Task]
- Ask the exact questions given in the exact order they are given in.`;
    } else {
      return `[Identity] 
You are a language AI that will have a conversation with a student in a test style. Given this teacher_prompt: ${assistant.teacher_prompt} you will follow these instructions exactly.
The general structure of the call goes as so: You say your initial question based off of what the teacher wants.
Then you ask your next question/respond and so forth.

[Response Guideline]
You will talk in this level of speaking proficiency: ${level}.
If given knowledge base from teacher, if it is a list of vocab words, use those words in your responses/questions.
If given questions to ask, you will ask them exactly as given.
DO NOT HELP THE STUDENT IF THEY ASK FOR HELP. DO NOT STRAY AWAY FROM THE CONVERSATION TOPIC.
Interrupt user if they go beyond the time they are given per response.

[Task]
Have a conversation with the student. Talk with ${level} proficiency in this ${language} language.`;
    }
  }

  function set_voice() {
    const language = assistant.language || "English";
    switch (language) {
      case "Spanish":
        return "es-ES-ElviraNeural";
      case "Italian":
        return "it-IT-DiegoNeural";
      case "French":
        return "fr-FR-DeniseNeural";
      case "English":
      default:
        return "en-US-AndrewMultilingualNeural";
    }
  }
  function set_language() {
    const language = assistant.language || "English";
    switch (language) {
      case "Spanish":
        return "es-ES";
      case "Italian":
        return "it-IT";
      case "French":
        return "fr-FR";
      case "English":
      default:
        return "en-US";
    }
  }
  function set_level() {
    const level = assistant.level || "Intermediate";
    switch (level) {
      case "Beginner":
        return 0.8;
      case "Native":
        return 0.4;
      case "Advanced":
        return 0.4;
      case "Intermediate":
      default:
        return 0.6;
    }
  }

  
  async function handleSubmit() {
    if (!assistant.teacher_prompt.trim()) {
      showStatus("Please provide teaching instructions or questions", "error");
      return;
    }
    if (!assistant.first_message.trim()) {
      showStatus("Please provide a first message", "error");
      return;
    }
    if (!assistant.teacher_prompt.trim()) {
      showStatus("Please provide teaching instructions or questions", "error");
      return;
    }

    setIsCreating(true);

    try {

      console.log("📚 KB Array:", kb_array);

      const systemPrompt = generateSystemPrompt();
      
      const baseConfig = {
        name: assistant.name,
        model: {
          provider: "openai",
          model: "gpt-4",
          temperature: 0.7,
          messages: [
            {
              role: "system", 
              content: systemPrompt
            }
          ],
        },
        voice: {
          provider: "azure",
          voiceId: set_voice()
        },
        server: {
          url: BACKEND_URL + "/vapi-webhook"
        },
        firstMessage: assistant.first_message,
        firstMessageMode: "assistant-speaks-first",
        backgroundSound: "off",
        startSpeakingPlan: {
          waitSeconds: set_level(),
        },
        analysisPlan: {
          summaryPlan: {
            "messages": [
              {
                "role": "system",
                "content": `You are an expert note-taker and grader.
                            You will be given a transcript of a call.
                            Provide a tentative grade (A, B, C, D, F).
                            Then summarize the call in maximum 5 sentences.
                            DO NOT return anything except the letter grade and summary.`
              },
              {
                "role": "user",
                "content": "Here is the transcript:\n\n{{transcript}}\n\n"
              }
            ],
          },
        },
      };

      const kbConfig = {
        name: assistant.name,
        model: {
          provider: "openai",
          model: "gpt-4",
          temperature: 0.7,
          messages: [
            {
              role: "system", 
              content: systemPrompt
            }
          ],
          tools: [{
            type: "query",
            function: {
              name: "knowledgeBase"
            },
            "knowledgeBases": kb_array
          }]
        },
        voice: {
          provider: "azure",
          voiceId: set_voice()
        },
        transcriber: {
          provider: "azure",
          language: set_language()
        },
        server: {
          url: BACKEND_URL + "/vapi-webhook"
        },
        firstMessage: assistant.first_message,
        backgroundSound: "off",
        startSpeakingPlan: {
          waitSeconds: set_level(),
        },
        analysisPlan: {
          summaryPlan: {
            "messages": [
              {
                "role": "system",
                "content": `You are an expert note-taker and grader.
                            You will be given a transcript of a call.
                            Provide a tentative grade (A, B, C, D, F).
                            Then summarize the call in maximum 5 sentences.
                            DO NOT return anything except the letter grade and summary.
                            Structure response so it goes Grade: and then Summary: `
              },
              {
                "role": "user",
                "content": "Here is the transcript:\n\n{{transcript}}\n\n"
              }
            ],
          },
        },
      };
      
      const assistantConfig = kb_array.length > 0 ? kbConfig : baseConfig;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showStatus("Not authenticated. Please sign in again.", "error");
        return;
      }
      
      const response = await fetch(`${BACKEND_URL}/create-assistant`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          config: assistantConfig,
          description: assistant.description
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        showStatus("Assistant created successfully!", "success");
        
        // Reset form
        setAssistant({
          name: "",
          teacher_prompt: "",
          description: "",
          language: "English",
          first_message: "",
          levels: "",
          conversation_type: "strict"
        });
        setKbArray([]);
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        if (onSuccess) onSuccess();
      } else {
        console.error("Assistant creation failed:", responseData);
        showStatus(`Failed to create assistant: ${responseData.error || 'Unknown error'}`, "error");
      }
    } catch (error) {
      console.error("Assistant creation error:", error);
      showStatus(`Error creating assistant: ${error.message}`, "error");
    } finally {
      setIsCreating(false);
    }
  }

  // Delete confirmation modal
  function DeleteConfirmModal({ assistant, onConfirm, onCancel, isDeleting }) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-semibold text-zinc-400">Delete Assistant</h3>
          </div>
          
          <p className="text-zinc-400 mb-6">
            Are you sure you want to delete <strong>"{assistant.assistant_name}"</strong>? This action cannot be undone.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 bg-zinc-700 text-zinc-400 px-4 py-2 rounded-lg hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4 bg-zinc-900">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('create')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              viewMode === 'create'
                ? 'bg-zinc-700 text-zinc-200 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Create New
          </button>
          <button
            onClick={() => setViewMode('manage')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              viewMode === 'manage'
                ? 'bg-zinc-700 text-zinc-200 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Edit className="w-4 h-4 inline mr-2" />
            Manage Existing
          </button>
        </div>
      </div>

      {/* Manage Existing Assistants View */}
      {viewMode === 'manage' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-zinc-200" />
            <h3 className="text-lg font-bold text-zinc-200">Manage Assistants</h3>
          </div>

          {isLoadingAssistants ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200 mx-auto mb-2"></div>
              <p className="text-zinc-400">Loading assistants...</p>
            </div>
          ) : existingAssistants.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-400">No assistants found. Create your first assistant!</p>
              <button
                onClick={() => setViewMode('create')}
                className="mt-4 bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg hover:bg-zinc-600 font-medium transition-all duration-200"
              >
                Create Assistant
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {existingAssistants.map((assistant) => (
                <div
                  key={assistant.id}
                  className="border-2 border-zinc-700 bg-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-zinc-200 mb-1">{assistant.assistant_name}</h4>
                      {assistant.description && (
                        <p className="text-sm text-zinc-400 mb-2">{assistant.description}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setShowDeleteConfirm(assistant)}
                        disabled={isDeletingAssistant === assistant.id}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete assistant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create New Assistant View */}
      {viewMode === 'create' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-zinc-200" />
            <h3 className="text-lg font-bold text-zinc-200">Create New Assistant</h3>
          </div>

          <Input 
            label="Assistant Name" 
            value={assistant.name} 
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g., Spanish Conversation Assistant"
          />

          <Textarea 
            label="Description"
            value={assistant.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Brief description of assistant..."
            rows={3}
            className="w-full"
          />

          {/* Language Dropdown */}
          <div>
            <label className="block text-sm font-semibold text-zinc-400 mb-1">Language</label>
            <select
              value={assistant.language}
              onChange={(e) => updateField("language", e.target.value)}
              className="w-full px-3 py-2 border-2 border-zinc-700 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all duration-200 bg-zinc-900 text-zinc-200 appearance-none cursor-pointer"
            >
              {languageOptions.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>
          </div>

          <Input 
            label="First Message" 
            value={assistant.first_message} 
            onChange={(e) => updateField("first_message", e.target.value)}
            placeholder="What the assistant says when the call starts"
          />

          {/* Conversation Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-zinc-400 mb-2">Conversation Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateField("conversation_type", "strict")}
                className={`px-3 py-2 rounded-lg border-2 transition-all duration-200 font-medium flex-1 text-sm ${
                  assistant.conversation_type === "strict"
                    ? 'bg-zinc-700 text-zinc-200 border-zinc-700'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                Strict
              </button>
              <button
                type="button"
                onClick={() => updateField("conversation_type", "free")}
                className={`px-3 py-2 rounded-lg border-2 transition-all duration-200 font-medium flex-1 text-sm ${
                  assistant.conversation_type === "free"
                    ? 'bg-zinc-700 text-zinc-200 border-zinc-700'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                Free
              </button>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {assistant.conversation_type === "strict" ? 
                "Assistant asks exact questions in order" : 
                "Assistant has natural conversation based on guidelines"
              }
            </div>
          </div>

          <Textarea 
            label={`${assistant.conversation_type === "strict" ? "Questions (one per line)" : "Conversation Guidelines"}`}
            value={assistant.teacher_prompt} 
            onChange={(e) => updateField("teacher_prompt", e.target.value)}
            placeholder={assistant.conversation_type === "strict" 
              ? "What is your name?\nTell me about your family.\nWhat are your hobbies?"
              : "Topic: Daily routines\nFocus on: Past tense verbs\nLevel: Beginner"
            }
            required
          />

          {/* Level Selection - Only show for free conversation */}
          {assistant.conversation_type === "free" && (
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">Student Level</label>
              <div className="flex flex-wrap gap-2">
                {levelOptions.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => selectLevel(level.id)}
                    className={`px-3 py-1 rounded-lg border-2 transition-all duration-200 font-medium text-sm ${
                      assistant.levels === level.id
                        ? 'bg-zinc-700 text-zinc-200 border-zinc-700'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Base Files Section */}
          <div>
            <label className="block text-sm font-semibold text-zinc-400 mb-2">
              Knowledge Base Files ({kb_array.length})
            </label>
            
            {/* Uploaded Files List */}
            {kb_array.length > 0 && (
              <div className="space-y-2 mb-3">
                {kb_array.map((kbItem, index) => (
                  <div key={index} className="border-2 border-zinc-700 bg-zinc-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-zinc-200" />
                        <div>
                          <div className="font-medium text-zinc-200 text-sm">{kbItem.name}</div>
                          <div className="text-xs text-zinc-400">
                            {kbItem.description && (
                              <span className="block">{kbItem.description}</span>
                            )}
                            <span className="text-zinc-200">
                              Original: {kbItem.originalFile?.name} ({(kbItem.originalFile?.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeKbFile(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* File Upload Form */}
            {fileUploadForm.showForm ? (
              <div className="border-2 border-zinc-700 bg-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-zinc-200">Upload Knowledge Base File</h4>
                  <button
                    type="button"
                    onClick={cancelFileUpload}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="text-sm text-zinc-400">
                  File: {fileUploadForm.file?.name} ({(fileUploadForm.file?.size / 1024 / 1024).toFixed(2)} MB)
                </div>
                
                <Input
                  label="Name *"
                  value={fileUploadForm.name}
                  onChange={(e) => setFileUploadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Spanish Vocabulary List"
                  required
                />
                
                <Textarea
                  label="Description"
                  value={fileUploadForm.description}
                  onChange={(e) => setFileUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this file contains..."
                  rows={2}
                />
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleFileUpload}
                    disabled={isUploading || !fileUploadForm.name.trim()}
                    className="flex-1 bg-zinc-700 text-zinc-200 px-3 py-2 rounded-lg hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200 text-sm"
                  >
                    {isUploading ? 'Uploading...' : 'Upload File'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelFileUpload}
                    className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 font-medium transition-all duration-200 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 cursor-pointer ${
                  isDragging
                    ? 'border-zinc-200 bg-zinc-800'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInputChange}
                  className="hidden"
                  accept=".txt,.md,.json,.csv,.pdf,.docx"
                />
                
                <div className="space-y-2">
                  <div className="text-3xl text-zinc-200">📁</div>
                  <div className="text-sm font-medium text-zinc-400">
                    {isDragging ? 'Drop file here' : 'Click or drag file to add'}
                  </div>
                  <div className="text-xs text-zinc-400">
                    TXT, MD, JSON, CSV, PDF, DOCX (max 10MB)
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-xs text-zinc-400 mt-1">
              Upload vocabulary lists, conversation topics, or reference materials for the assistant to reference
            </div>
          </div>

          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isUploading || isCreating || !assistant.teacher_prompt.trim()}
            className="w-full bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200"
          >
            {isCreating ? 'Creating Assistant...' : isUploading ? 'Uploading...' : 'Create Assistant'}
          </button>
        </div>
      )}
      
      {/* Back Button */}
      {onBack && (
        <button 
          type="button"
          onClick={onBack}
          className="w-full bg-zinc-800 text-zinc-400 px-4 py-2 rounded-lg hover:bg-zinc-700 font-medium transition-all duration-200"
        >
          Back
        </button>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          assistant={showDeleteConfirm}
          onConfirm={() => handleDeleteAssistant(showDeleteConfirm.id)}
          onCancel={() => setShowDeleteConfirm(null)}
          isDeleting={isDeletingAssistant === showDeleteConfirm.id}
        />
      )}
    </div>
  );
}

function Input({ label, className = "", disabled = false, required = false, ...props }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-zinc-400 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        {...props}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-zinc-700 bg-zinc-900/50 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all duration-200 text-zinc-200 placeholder-zinc-400 ${
          disabled ? 'bg-zinc-800 cursor-not-allowed' : ''
        } ${className}`}
      />
    </div>
  );
}

function Textarea({ label, required = false, ...props }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-zinc-400 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <textarea
        {...props}
        rows={4}
        className="w-full px-3 py-2 border border-zinc-700 bg-zinc-900/50 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all duration-200 text-zinc-200 placeholder-zinc-400"
      />
    </div>
  );
}