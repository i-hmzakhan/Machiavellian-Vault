// During deployment, we will change this to your Hugging Face Space URL via Vercel Environment Variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// The secret key that must match the Python backend
const VAULT_API_KEY = process.env.NEXT_PUBLIC_VAULT_API_KEY || 'local_dev_key_999';

// Helper function to attach the key to all requests
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Vault-Key': VAULT_API_KEY
});

export async function getNetworkData() {
  try {
    const response = await fetch(`${API_BASE_URL}/network`, {
      headers: getHeaders() // <-- Sending the key
    });
    if (!response.ok) throw new Error('Failed to fetch network graph');
    const data = await response.json();
    return data.network; 
  } catch (error) {
    console.error("Network Fetch Error:", error);
    return { nodes: [], links: [] }; 
  }
}
export async function addNode(name: string, baseValue: number, backstory: string) {
  const response = await fetch(`${API_BASE_URL}/add-node`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, base_value: baseValue, backstory }),
  });
  if (!response.ok) throw new Error('Failed to add target');
  return await response.json();
}

export async function deleteNode(targetId: string) {
  const response = await fetch(`${API_BASE_URL}/delete-node`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_entity_id: targetId }),
  });
  if (!response.ok) throw new Error('Failed to terminate target');
  return await response.json();
}

// --- NEW PHASE 5 ENDPOINTS ---

export async function commitGlobalLog(rawLog: string) {
  const response = await fetch(`${API_BASE_URL}/commit-global`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ raw_log: rawLog }),
  });
  if (!response.ok) throw new Error('Failed to route global commit');
  return await response.json();
}

// Add the history parameter to the function
export async function getStrategicAdvice(scenario: string, history: any[] = []) {
  const response = await fetch(`${API_BASE_URL}/get-advice-global`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ 
      scenario_question: scenario,
      chat_history: history // Pass the thread to Python
    }),
  });
  if (!response.ok) throw new Error('Failed to fetch advice');
  return await response.json();
}

export async function getNodeHistory(targetId: string) {
  const response = await fetch(`${API_BASE_URL}/node-history`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ target_entity_id: targetId }),
  });
  if (!response.ok) throw new Error('Failed to fetch history');
  return await response.json();
}