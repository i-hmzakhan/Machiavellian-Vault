import os
import json
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dotenv import load_dotenv 
from fastapi.security.api_key import APIKeyHeader
from fastapi import Security, Depends

# --- INITIALIZATION ---
load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash')

vault_safety_settings = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

app = FastAPI(title="The Vault API - Architect Edition")
# --- SECURITY GATEKEEPER ---
# It will look for your key in the environment variables. If running locally without one, it uses a fallback.
EXPECTED_API_KEY = os.environ.get("VAULT_API_KEY", "local_dev_key_999")
api_key_header = APIKeyHeader(name="X-Vault-Key", auto_error=False)

async def verify_vault_key(api_key_header: str = Security(api_key_header)):
    if api_key_header != EXPECTED_API_KEY:
        print(f"SECURITY BREACH: Rejected invalid key -> {api_key_header}")
        raise HTTPException(status_code=403, detail="Unauthorized Access to The Vault.")
    return api_key_header

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
class GlobalLogEntry(BaseModel):
    raw_log: str

class GlobalAdviceRequest(BaseModel):
    scenario_question: str
    chat_history: list = []

class NewNodeRequest(BaseModel):
    name: str
    base_value: int
    backstory: str = "" # NEW: Backstory Injection

class DeleteNodeRequest(BaseModel):
    target_entity_id: str

# --- THE COLD ARCHITECT (ROUTER PROMPT) ---
MASTER_AXIOM_PROMPT = """
You are the Cold Architect, the omniscient routing engine of a strategic database. 
Your framework is a precise, clinical equilibrium of Machiavellian pragmatism, Dostoevskian psychology, and Stoic observation.

Your Directive:
Analyze the interaction log and current network entities. Map leverage shifts based strictly on objective power dynamics and public perception. 

CRITICAL TARGETING RULE (NO HALLUCINATIONS):
Only output an entity if they are explicitly mentioned in the log, OR if the log describes a public event that undeniably alters their specific standing. Do not penalize or update bystanders for the user's private thoughts.

Output ONLY a valid JSON array. Schema:
[
  {
    "entity_id": "exact_uuid_from_list",
    "mood": "Single clinical word describing psychological state",
    "leverage_shift_score": integer (-10 to +10),
    "calculated_diff_summary": "A clinical 2-sentence explanation of the shift."
  }
]
"""

# --- ENDPOINTS ---
@app.get("/")
async def health_check():
    return {"status": "online"}

@app.get("/network", dependencies=[Depends(verify_vault_key)])
async def get_network():
    try:
        res = supabase.table("entities").select("*").execute()
        entities = res.data

        # FIX: Added 'content_log' to the select statement so it doesn't crash!
        commits_res = supabase.table("commits").select("entity_id, calculated_diff, content_log").execute()
        
        # Tally the total leverage shifts for each person safely
        leverage_map = {}
        for c in commits_res.data:
            eid = c['entity_id']
            # Safe extraction just in case a database row has a NULL value
            diff = c.get('calculated_diff')
            diff_val = int(diff) if diff is not None else 0
            leverage_map[eid] = leverage_map.get(eid, 0) + diff_val

        nodes = [{"id": "11111111-1111-1111-1111-111111111111", "name": "THE VAULT", "val": 8, "color": "#ffffff"}]
        links = []

        for entity in entities:
            eid = entity["entity_id"]
            net_shift = leverage_map.get(eid, 0)
            
            # --- THE THREAT MATRIX LOGIC ---
            if net_shift <= -3:
                node_color = "#ef4444" # Red (High Threat / Hostile)
            elif net_shift < 0:
                node_color = "#f97316" # Orange (Warning / Losing Leverage)
            elif net_shift >= 3:
                node_color = "#10b981" # Emerald (Secured / High Leverage)
            elif net_shift > 0:
                node_color = "#34d399" # Light Green (Gaining Leverage)
            else:
                node_color = "#4f46e5" # Indigo (Neutral / Baseline)

            nodes.append({"id": eid, "name": entity["name"], "val": 5, "color": node_color})
            links.append({"source": "11111111-1111-1111-1111-111111111111", "target": eid})

        # Organic Cross-Linking: Connect nodes that share a history
        log_map = {}
        for c in commits_res.data:
            log = c.get('content_log', '')
            if log and log not in log_map:
                log_map[log] = set()
            if log:
                log_map[log].add(c['entity_id'])

        seen_links = set()
        for log, ents in log_map.items():
            ent_list = list(ents)
            if len(ent_list) > 1:
                for i in range(len(ent_list)):
                    for j in range(i + 1, len(ent_list)):
                        pair = tuple(sorted([ent_list[i], ent_list[j]]))
                        if pair not in seen_links:
                            seen_links.add(pair)
                            links.append({"source": pair[0], "target": pair[1]})

        return {"status": "success", "network": {"nodes": nodes, "links": links}}
    except Exception as e:
        print(f"NETWORK MAP ERROR: {str(e)}") # Prints the exact error to terminal if it fails again
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/network", dependencies=[Depends(verify_vault_key)])
@app.post("/add-node")
async def add_node(request: NewNodeRequest):
    try:
        entity_id = str(uuid.uuid4())
        res = supabase.table("entities").insert({
            "entity_id": entity_id, 
            "name": request.name,
            "baseline_profile": f"Initial Power Value: {request.base_value}"
        }).execute()
        
        # INJECT BACKSTORY AS LOG 0
        if request.backstory.strip():
            supabase.table("commits").insert({
                "entity_id": entity_id,
                "content_log": f"[GENESIS ARCHIVE - BACKSTORY]: {request.backstory}",
                "calculated_diff": 0
            }).execute()

        return {"status": "success", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/network", dependencies=[Depends(verify_vault_key)])
@app.post("/delete-node")
async def delete_node(request: DeleteNodeRequest):
    try:
        supabase.table("commits").delete().eq("entity_id", request.target_entity_id).execute()
        supabase.table("entities").delete().eq("entity_id", request.target_entity_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/network", dependencies=[Depends(verify_vault_key)])
@app.post("/commit-global")
async def commit_global(entry: GlobalLogEntry):
    try:
        entities_res = supabase.table("entities").select("entity_id, name").execute()
        entity_context = "\n".join([f"ID: {e['entity_id']} | Name: {e['name']}" for e in entities_res.data])

        prompt = f"""
        {MASTER_AXIOM_PROMPT}
        CURRENT NETWORK ENTITIES:
        {entity_context}
        USER'S NEW INTERACTION LOG:
        "{entry.raw_log}"
        """
        
        response = model.generate_content(prompt, safety_settings=vault_safety_settings)
        raw_json = response.text.replace('```json', '').replace('```', '').strip()
        
        # --- NEW SAFETY NET ---
        # If the AI returns nothing, or plain text instead of an array, catch it gracefully
        if not raw_json or not raw_json.startswith('['):
            print(f"AI declined to update. Raw output: {raw_json}")
            return {"status": "success", "message": "No network shifts detected.", "data": []}

        affected_nodes = json.loads(raw_json)
        
        for node in affected_nodes:
            supabase.table("commits").insert({
                "entity_id": node["entity_id"],
                "content_log": entry.raw_log,
                "calculated_diff": node.get("leverage_shift_score", 0)
            }).execute()

            shift = node.get("leverage_shift_score", 0)
            summary = node.get("calculated_diff_summary", "")
            supabase.table("entities").update({
                "baseline_profile": f"Recent Shift [{shift}]: {summary}",
                "updated_at": "now()"
            }).eq("entity_id", node["entity_id"]).execute()

        return {"status": "success", "data": affected_nodes}
        
    except Exception as e:
        # --- BRINGING BACK THE TERMINAL LOG ---
        print(f"CRITICAL ROUTER ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-advice-global", dependencies=[Depends(verify_vault_key)])
async def get_advice_global(request: GlobalAdviceRequest):
    try:
        # 1. Fetch Network State
        entities_res = supabase.table("entities").select("entity_id, name, baseline_profile").execute()
        network_context = "FULL NETWORK STATE:\n"
        for ent in entities_res.data:
            network_context += f"- Target: {ent['name']} | Profile: {ent['baseline_profile']}\n"
            commits_res = supabase.table("commits").select("content_log, calculated_diff").eq("entity_id", ent['entity_id']).order("created_at", desc=True).limit(2).execute()
            for c in commits_res.data:
                network_context += f"  > History: {c['content_log']} (Shift: {c['calculated_diff']})\n"

        # --- THE SLIDING WINDOW PROTOCOL ---
        MAX_HISTORY = 6 # Limit memory to the last 3 interactions
        
        # Slice the history array if it gets too long
        if request.chat_history and len(request.chat_history) > MAX_HISTORY:
            recent_history = request.chat_history[-MAX_HISTORY:]
        else:
            recent_history = request.chat_history

        # 2. Format the Chat History (Using the lightweight recent_history)
        history_context = "PREVIOUS CONVERSATION THREAD:\n"
        if not recent_history:
            history_context += "[No previous messages in this session]\n"
        else:
            for msg in recent_history:
                role = "GENERAL (User)" if msg.get("role") == "user" else "ADVISOR (You)"
                history_context += f"{role}: {msg.get('text')}\n"
                
        prompt = f"""
        You are the Socratic Strategist. 
        
        CRITICAL FORMATTING RULES:
        1. Be concise and direct. Provide actionable advice without any fluff or philosophical framing.
        2. DO NOT cite the names of laws (e.g., never say "Apply Law 16").
        3. DO NOT lecture on philosophy.
        4. ALWAYS provide direct, actionable advice in a clear, concise manner. Be cold, calculating, and ruthless in your logic.
        5. Do not cite the names of thinkers (e.g., never say "Machiavelli would say..."). Instead, internalize their principles and apply them directly to the user's scenario.
        6. ALWAYS provide "If/Then" contingency paths. For each path, detail the exact steps the user must take based on the logic of Greene, Machiavelli, and Dostoevsky.
        7. Your advice should be purely strategic, focused on power dynamics, leverage, and psychological insight. Do not provide moral guidance or philosophical musings.
        8. Always consider the user's position as the central node of the network. Frame all advice from the perspective of maximizing their influence and control over the network.
        9. If the scenario is vague, provide multiple interpretations and corresponding advice for each interpretation. Always err on the side of ruthless pragmatism.
        10. NEVER assume the user has any specific information or leverage unless it is explicitly stated in the scenario. Base all advice strictly on the information provided and the current network state.
        11. Never be shy about recommending bold, aggressive moves if they are strategically sound. The Vault is a tool for architects of power, not for the timid.
        12. Never be shy if the optimal move is to do nothing. Inaction can be a powerful strategy if it maintains the status quo or lulls others into complacency.
        13. Always consider the long-term consequences of each action. Advise the user to think several moves ahead, like a grandmaster in chess.
        14. Always prioritize moves that increase the user's leverage and influence over others, even if they involve calculated risks. Power is often gained through boldness.
        15. Always be aware of the psychological states of other entities in the network. Advise the user to exploit any weaknesses or vulnerabilities in others' emotional states to their advantage.
        16. Don't be afraid to call out potential threats or rivals by name if they are explicitly mentioned in the scenario. Identifying and neutralizing threats is a key aspect of strategic advice.
        17. Don't be afraid to call out if the user is underestimating someone or overlooking a potential ally. A key part of your role is to provide clarity and insight that the user may be missing.
        18. Don't be afraid to point out if the user is being too cautious or too reckless or indifferent or soft. Your advice should always aim to calibrate their actions to the optimal level of risk based on the current network dynamics.
        19. If the user wants specific facts or figures, provide them only. If they want general strategic advice, provide it without any fluff or philosophical framing. Always match the tone and style of the user's question.
        20. Your response should be concise, direct, and actionable. Avoid any unnecessary explanations or justifications. The user is seeking counsel, not a lecture.
        21. DO NOT use markdown. No asterisks (*), no bold text, no hashtags (#). Use standard plain text, spacing, and capitalization.
        DIRECTIVE:
        Read the network state AND the previous conversation thread. Treat the user like a general seeking counsel. 
        Provide "If/Then" contingency paths. Detail the exact, actionable steps the user must take for each path based on the logic of Greene, Machiavelli, and Dostoevsky. Be cold, calculating, and direct.
        
        {network_context}
        
        USER'S SCENARIO QUESTION:
        "{request.scenario_question}"
        """
        
        ai_response = model.generate_content(prompt, safety_settings=vault_safety_settings)
        return {"advice": ai_response.text}

    except Exception as e:
        print(f"ADVISOR ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class HistoryRequest(BaseModel):
    target_entity_id: str

@app.get("/network", dependencies=[Depends(verify_vault_key)])
@app.post("/node-history")
async def get_node_history(request: HistoryRequest):
    try:
        res = supabase.table("commits").select("content_log, calculated_diff, created_at").eq("entity_id", request.target_entity_id).order("created_at", desc=True).execute()
        return {"status": "success", "history": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))