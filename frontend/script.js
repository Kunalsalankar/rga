const imageInput = document.getElementById('imageInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('error');

const preview = document.getElementById('preview');
const previewEmpty = document.getElementById('previewEmpty');

const result = document.getElementById('result');
const faultText = document.getElementById('faultText');
const confidenceText = document.getElementById('confidenceText');
const ragText = document.getElementById('ragText');
const geminiText = document.getElementById('geminiText');

let currentFile = null;

function formatGeminiResponse(text) {
  // Convert markdown-style text to HTML
  let html = text;
  
  // Escape HTML first
  const div = document.createElement('div');
  div.textContent = html;
  html = div.innerHTML;
  
  // Convert headers
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // Convert bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert italic *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Convert bullet points - (space)
  html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
  
  // Wrap consecutive list items in <ul>
  html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\n<ul>/g, '');
  
  // Convert numbered lists
  html = html.replace(/^\d+\.\s(.*?)$/gm, '<li>$1</li>');
  
  // Convert line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<[hu][l1-6])/g, '$1');
  html = html.replace(/(<\/[hu][l1-6]>)<\/p>/g, '$1');
  
  return html;
}

function setError(msg) {
  if (!msg) {
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
    return;
  }
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
}

function setLoading(isLoading) {
  loading.classList.toggle('hidden', !isLoading);
  analyzeBtn.disabled = isLoading || !currentFile;
}

imageInput.addEventListener('change', () => {
  const f = imageInput.files && imageInput.files[0];
  currentFile = f || null;
  setError('');
  result.classList.add('hidden');

  if (!currentFile) {
    preview.style.display = 'none';
    previewEmpty.classList.remove('hidden');
    analyzeBtn.disabled = true;
    return;
  }

  const url = URL.createObjectURL(currentFile);
  preview.src = url;
  preview.onload = () => URL.revokeObjectURL(url);
  preview.style.display = 'block';
  previewEmpty.classList.add('hidden');
  analyzeBtn.disabled = false;
});

analyzeBtn.addEventListener('click', async () => {
  if (!currentFile) return;

  setError('');
  setLoading(true);
  result.classList.add('hidden');

  try {
    const form = new FormData();
    form.append('file', currentFile);

    const resp = await fetch('/analyze', {
      method: 'POST',
      body: form,
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const detail = data && (data.detail || JSON.stringify(data));
      throw new Error(detail || `Request failed (${resp.status})`);
    }

    faultText.textContent = data.fault ?? '-';
    confidenceText.textContent = (typeof data.confidence === 'number') ? data.confidence.toFixed(4) : '-';
    ragText.textContent = data.rag_context ?? '';
    
    // Format Gemini output as HTML
    const geminiContent = data.gemini_suggestion ?? '';
    geminiText.innerHTML = formatGeminiResponse(geminiContent);

    result.classList.remove('hidden');
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  } finally {
    setLoading(false);
  }
});
