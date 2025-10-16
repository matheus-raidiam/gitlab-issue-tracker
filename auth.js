// Optional Supabase auth + remote comments storage
// Configure via environment or inline constants below:
const SB_URL = window.SUPABASE_URL || '';
const SB_ANON = window.SUPABASE_ANON_KEY || '';
let sb = null;
try{
  if (SB_URL && SB_ANON && window.supabase){ sb = window.supabase.createClient(SB_URL, SB_ANON); }
}catch{ sb = null; }

async function sbLogin(email, password){
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
async function sbGetUser(){
  if (!sb) return null;
  const { data:{ user } } = await sb.auth.getUser();
  return user || null;
}
async function sbUpsertComment(projectId, iid, text){
  const user = await sbGetUser();
  if (!user) return false;
  const { error } = await sb.from('comments').upsert({ project_id:projectId, iid, user_id:user.id, text });
  if (error) { console.error('sb upsert error', error); return false; }
  return true;
}
async function sbFetchComment(projectId, iid){
  const user = await sbGetUser();
  if (!user) return null;
  const { data, error } = await sb.from('comments').select('text').eq('project_id', projectId).eq('iid', iid).eq('user_id', user.id).maybeSingle();
  if (error) { console.error('sb fetch error', error); return null; }
  return (data && data.text) || null;
}

// Login page wiring
if (document.getElementById('loginBtn')){
  document.getElementById('loginBtn').addEventListener('click', async ()=>{
    const email = document.getElementById('email').value.trim();
    const pass  = document.getElementById('password').value;
    const msg = document.getElementById('msg');
    msg.textContent = 'Signing in...';
    try{
      await sbLogin(email, pass);
      msg.textContent = 'Logged in. You can close this tab.';
    }catch(e){
      msg.textContent = 'Login failed: ' + (e.message||e);
    }
  });
}

// Hook into existing comments API on index.html if present
window.remoteComments = {
  enabled: !!sb,
  async load(projectId, iid){
    if (!sb) return null;
    try{ return await sbFetchComment(projectId, iid); }catch{ return null; }
  },
  async save(projectId, iid, text){
    if (!sb) return false;
    try{ return await sbUpsertComment(projectId, iid, text); }catch{ return false; }
  }
};
