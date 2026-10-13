(() => {
  const TRIAL_KEY = 'apc_guest_trial_v1';
  const CLAIMS_KEY = 'apc_pending_profile_claims_v1';
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const freshTrial = () => ({ session_id: uuid(), active_seconds: 0, tower_handoffs: 0, center_handoffs: 0, used: false, imported_user_id: null });
  let trial = safeRead(TRIAL_KEY, null) || freshTrial();
  safeWrite(TRIAL_KEY, trial);
  let client = null, user = null, profile = null, currentRun = null, tickAt = 0, mode = 'login', busy = false, authReady = false, trialImporting = false;
  let friendRows = [], presenceTimer = null;
  const $id = id => document.getElementById(id);
  const message = (text, kind = '') => { const el = $id('accountMessage'); if (el) { el.textContent = text; el.dataset.kind = kind; } };
  const rankFor = level => level >= 20 ? 'SUPERVISING CONTROLLER' : level >= 12 ? 'SENIOR CONTROLLER' : level >= 7 ? 'APPROACH CONTROLLER' : level >= 3 ? 'JUNIOR CONTROLLER' : 'TRAINEE';
  const levelFor = xp => { let level = 1, next = 100; while (xp >= next) { level++; next += level * 100; } return level; };
  const number = value => Math.max(0, Number(value) || 0).toLocaleString();
  const playTime = seconds => { const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`; };
  const MILES_PER_ACTIVE_MINUTE = 10, XP_PER_ACTIVE_MINUTE = 10, MILES_PER_HANDOFF = 150, XP_PER_HANDOFF = 100;
  const rewardForClaim = claim => {
    const minutes = Math.floor(Math.max(0, Number(claim.active_seconds) || 0) / 60);
    const handoffs = Math.max(0, Number(claim.tower_handoffs) || 0) + Math.max(0, Number(claim.center_handoffs) || 0);
    return { miles: minutes * MILES_PER_ACTIVE_MINUTE + handoffs * MILES_PER_HANDOFF, xp: minutes * XP_PER_ACTIVE_MINUTE + handoffs * XP_PER_HANDOFF };
  };
  const showAccount = () => { $('#ov').style.display = 'flex'; show('m-account'); };
  const friendMessage = (text = '', kind = '') => { const el = $id('friendMessage'); if (el) { el.textContent = text; el.dataset.kind = kind; } };
  const rpc = async (name, args = {}) => { const { data, error } = await client.rpc(name, args); if (error) throw error; return data; };
  const timeUntilUsernameChange = () => {
    if (!profile?.username_changed_at) return null;
    const remaining = new Date(profile.username_changed_at).getTime() + 30 * 86400000 - Date.now();
    return remaining > 0 ? remaining : null;
  };
  const durationText = ms => { const days = Math.ceil(ms / 86400000); if (days > 1) return `${days} days`; const hours = Math.ceil(ms / 3600000); return `${hours} hour${hours === 1 ? '' : 's'}`; };

  function paintFriends() {
    if (!user || !profile) return;
    const username = $id('friendUsername'); if (username) username.textContent = profile.username || '—';
    const nextAllowed = timeUntilUsernameChange();
    const hint = $id('usernameChangeHint'), input = $id('newUsername'), change = $id('usernameForm')?.querySelector('button');
    if (hint) hint.textContent = nextAllowed ? `Username changes again in ${durationText(nextAllowed)}.` : 'You can change your username once every 30 days.';
    if (input) input.disabled = !!nextAllowed;
    if (change) change.disabled = !!nextAllowed;
    const visible = $id('presenceVisible'); if (visible) visible.checked = profile.presence_visible !== false;
    const list = $id('friendList'); if (!list) return;
    const friends = friendRows.filter(row => row.relation === 'friend');
    const incoming = friendRows.filter(row => row.relation === 'incoming');
    const outgoing = friendRows.filter(row => row.relation === 'outgoing');
    $id('friendCount').textContent = String(friends.length);
    const statusLabel = status => status === 'in_session' ? 'IN SESSION' : status === 'online' ? 'ONLINE' : 'OFFLINE';
    const card = (row, relation) => `<article class="friend-card"><span class="friend-presence ${row.presence === 'online' || row.presence === 'in_session' ? 'is-online' : ''}"></span><div class="friend-card-copy"><b>${esc(row.username)}</b><small>${esc(row.rank)} · LEVEL ${Number(row.level) || 1}</small>${relation === 'friend' ? `<em>${statusLabel(row.presence)}</em>` : ''}</div><div class="friend-card-actions">${relation === 'incoming' ? `<button data-friend-action="accept" data-friend-id="${esc(row.user_id)}">ACCEPT</button><button data-friend-action="decline" data-friend-id="${esc(row.user_id)}">DECLINE</button><button data-friend-action="block" data-friend-id="${esc(row.user_id)}">BLOCK</button>` : relation === 'outgoing' ? `<small>REQUEST SENT</small><button data-friend-action="remove" data-friend-id="${esc(row.user_id)}" aria-label="Cancel request to ${esc(row.username)}">CANCEL</button><button data-friend-action="block" data-friend-id="${esc(row.user_id)}">BLOCK</button>` : `<button data-friend-action="remove" data-friend-id="${esc(row.user_id)}">REMOVE</button><button data-friend-action="block" data-friend-id="${esc(row.user_id)}">BLOCK</button>`}</div></article>`;
    list.innerHTML = [
      incoming.length ? `<div class="friend-list-label">INCOMING REQUESTS · ${incoming.length}</div>${incoming.map(row => card(row, 'incoming')).join('')}` : '',
      outgoing.length ? `<div class="friend-list-label">SENT REQUESTS · ${outgoing.length}</div>${outgoing.map(row => card(row, 'outgoing')).join('')}` : '',
      friends.length ? `<div class="friend-list-label">YOUR FRIENDS · ${friends.length}</div>${friends.map(row => card(row, 'friend')).join('')}` : ''
    ].filter(Boolean).join('') || '<div class="friend-empty">No friends yet. Search by exact username to add someone.</div>';
  }

  async function loadFriends() {
    if (!client || !user) return;
    try { friendRows = await rpc('list_friend_connections') || []; paintFriends(); }
    catch (error) { friendMessage(error.message || 'Could not load friends. Apply the friends migration in Supabase.', 'error'); }
  }

  async function updatePresence() {
    if (!client || !user || !profile) return;
    try { await rpc('set_player_presence', { show_presence: profile.presence_visible !== false, current_activity: run ? 'in_session' : 'online' }); }
    catch (error) { console.warn('Could not update online status:', error); }
  }

  function animateRewardCount(element, target, delay = 0) {
    if (!element) return;
    const endValue = Math.max(0, Number(target) || 0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { element.textContent = endValue.toLocaleString(); return; }
    element.textContent = '0';
    setTimeout(() => {
      const started = performance.now(), duration = 780;
      const frame = now => {
        const t = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        element.textContent = Math.round(endValue * eased).toLocaleString();
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, delay);
  }

  window.apcUpdateDebriefRewards = () => {
    const state = window.apcDebriefRewardState;
    if (!state || !$id('repRewardPanel')) return;
    const panel = $id('repRewardPanel'), status = $id('repRewardStatus'), note = $id('repRewardNote');
    const progress = $id('repRewardProgress'), levelUp = $id('repLevelUp');
    panel.classList.remove('is-ready', 'is-trial', 'is-pending', 'is-level-up', 'is-rank-up');
    levelUp.hidden = true; levelUp.textContent = '';
    if (state.status === 'syncing' || state.status === 'queued') {
      panel.classList.add('is-pending');
      status.textContent = state.status === 'syncing' ? 'SYNCING REWARDS' : 'WAITING TO SYNC';
      $id('repRewardLabel').textContent = 'ACCOUNT REWARD CLAIM';
      $id('repXpEarned').textContent = state.status === 'syncing' ? '…' : 'PENDING';
      $id('repMilesEarned').textContent = state.status === 'syncing' ? '…' : 'PENDING';
      $id('repTotalXp').textContent = '—'; $id('repTotalMiles').textContent = '—';
      $id('repLevelText').textContent = 'LEVEL PROGRESS'; $id('repXpToNext').textContent = 'WAITING';
      $id('repProgressFill').style.width = '0%'; progress.hidden = false;
      note.textContent = state.status === 'syncing'
        ? 'Rewards are being confirmed by your profile. This summary will update when the claim finishes.'
        : 'The reward claim is saved on this device and will retry when your profile syncs. It has not been credited yet.';
      return;
    }
    if (state.status === 'trial') {
      panel.classList.add('is-trial');
      status.textContent = 'GUEST TRIAL · UNSAVED';
      $id('repRewardLabel').textContent = 'TRIAL REWARDS';
      progress.hidden = true;
      note.textContent = 'These rewards are not on an account yet. Create an account to save and transfer your trial progress.';
      animateRewardCount($id('repXpEarned'), state.earnedXp, 0);
      animateRewardCount($id('repMilesEarned'), state.earnedMiles, 145);
      return;
    }
    if (state.status !== 'synced') {
      status.textContent = 'REWARDS UNAVAILABLE';
      $id('repRewardLabel').textContent = 'ACCOUNT REWARD CLAIM';
      $id('repXpEarned').textContent = '—'; $id('repMilesEarned').textContent = '—';
      progress.hidden = true; note.textContent = 'Reward details could not be loaded.';
      return;
    }

    panel.classList.add('is-ready');
    status.textContent = 'CREDITED TO PROFILE';
    $id('repRewardLabel').textContent = 'SESSION REWARDS';
    $id('repTotalXp').textContent = number(state.currentXp);
    $id('repTotalMiles').textContent = number(state.currentMiles);
    const level = levelFor(Number(state.currentXp));
    const floor = 100 * (level - 1) * level / 2;
    const next = 100 * level * (level + 1) / 2;
    const pct = Math.max(0, Math.min(100, (Number(state.currentXp) - floor) / Math.max(1, next - floor) * 100));
    $id('repLevelText').textContent = `LEVEL ${level} → ${level + 1}`;
    $id('repXpToNext').textContent = `${number(Math.max(0, next - Number(state.currentXp)))} XP TO NEXT`;
    const fill = $id('repProgressFill'); fill.style.width = '0%';
    progress.hidden = false;
    note.textContent = 'Added to your controller profile.';
    if (state.levelUp || state.rankUp) {
      panel.classList.add('is-level-up');
      if (state.rankUp) panel.classList.add('is-rank-up');
      levelUp.hidden = false;
      levelUp.textContent = state.rankUp ? `RANK UP · ${state.newRank}` : `LEVEL UP · LEVEL ${level}`;
    }
    animateRewardCount($id('repXpEarned'), state.earnedXp, 0);
    animateRewardCount($id('repMilesEarned'), state.earnedMiles, 145);
    const progressDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 950;
    setTimeout(() => { fill.style.width = `${pct}%`; }, progressDelay);
  };

  function paintDock() {
    const dock = $id('profileDock');
    if (!dock) return;
    dock.hidden = !!run || !$id('m-main')?.classList.contains('on');
    if (user && profile) {
      const level = levelFor(Number(profile.xp));
      $id('profileDockName').textContent = profile.username || profile.display_name;
      $id('profileDockRank').textContent = rankFor(level);
      $id('profileDockLevel').textContent = `LVL ${level}`;
      $id('profileAvatar').textContent = (profile.username || profile.display_name).trim().charAt(0).toUpperCase() || '✦';
      dock.setAttribute('aria-label', `Profile for ${profile.username || profile.display_name}, level ${level}, ${rankFor(level)}`);
    } else {
      $id('profileDockName').textContent = 'GUEST PILOT';
      $id('profileDockRank').textContent = trial.used ? 'ACCOUNT REQUIRED TO PLAY AGAIN' : 'ONE FREE SESSION · UP TO 20 MIN';
      $id('profileDockLevel').textContent = 'GUEST';
      $id('profileAvatar').textContent = '✦';
      dock.setAttribute('aria-label', 'Open account and profile');
    }
  }

  function paintProfile() {
    const signedIn = !!user && !!profile;
    $id('accountAuthPanel').hidden = signedIn;
    $id('accountSignedIn').hidden = !signedIn;
    $id('accountProfileSummary').hidden = !signedIn;
    if (signedIn) {
      const xp = Math.max(0, Number(profile.xp) || 0);
      const level = levelFor(xp);
      const levelFloor = 100 * (level - 1) * level / 2;
      const nextLevel = 100 * level * (level + 1) / 2;
      const progress = Math.max(0, Math.min(100, (xp - levelFloor) / Math.max(1, nextLevel - levelFloor) * 100));
      const xpRemaining = Math.max(0, nextLevel - xp);
      $id('accountHeading').textContent = 'CONTROLLER PROFILE';
      $id('accountIntro').textContent = 'Your controller record, at a glance.';
      $id('accountProfileSummary').innerHTML = `
        <div class="profile-hero-main">
          <span class="profile-avatar-large">${esc((profile.username || profile.display_name).trim().charAt(0).toUpperCase() || '✦')}</span>
          <div class="profile-identity"><span class="profile-rank-chip"><i></i>${esc(rankFor(level))}</span><h3>${esc(profile.username || profile.display_name)}</h3><p>RIGA APPROACH · CONTROLLER</p></div>
          <div class="profile-level-badge"><small>LEVEL</small><b>${level}</b></div>
        </div>
        <div class="profile-xp-progress">
          <div class="profile-xp-label"><span>EXPERIENCE</span><b>${number(xp)} <i>/ ${number(nextLevel)} XP</i></b></div>
          <div class="profile-xp-track" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><span style="width:${progress}%"></span></div>
          <small>${number(xpRemaining)} XP TO NEXT LEVEL</small>
        </div>`;
      $id('accountProfileStats').innerHTML = [
        ['MILES', number(profile.miles), 'miles'], ['ACTIVE PLAY', playTime(profile.active_seconds), 'time'],
        ['TOWER HANDOFFS', number(profile.tower_handoffs), 'tower'], ['CENTER HANDOFFS', number(profile.center_handoffs), 'center']
      ].map(([label, value, key]) => `<div class="account-stat account-stat-${key}"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('');
      paintFriends();
    } else {
      $id('accountHeading').textContent = 'YOUR CONTROLLER PROFILE';
      $id('accountIntro').textContent = 'Save your progress across sessions. Miles and XP are credited to your account.';
      $id('accountProfileStats').innerHTML = '';
      message(trial.used ? 'Your free session is complete. Sign in or create an account to keep playing.' : 'One free session is available for up to 20 minutes. Create an account afterward to keep playing and save its rewards.');
    }
    paintDock();
  }

  async function readProfile() {
    if (!client || !user) { profile = null; paintProfile(); return; }
    const { data, error } = await client.from('player_profiles').select('user_id,display_name,username,username_changed_at,presence_visible,xp,miles,active_seconds,tower_handoffs,center_handoffs').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Your profile row is missing. Run the profile migration in Supabase SQL Editor, then sign in again.');
    profile = data;
    paintProfile();
    await loadFriends();
    await updatePresence();
  }

  async function existingClaim(uid, sessionId) {
    const { data, error } = await client.from('session_reward_claims').select('session_id,miles_earned,xp_earned').eq('user_id', uid).eq('session_id', sessionId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function sendClaim(claim) {
    if (!client || !user || claim.user_id !== user.id) return false;
    const previousClaim = await existingClaim(user.id, claim.session_id);
    if (previousClaim) {
      const { data: totals, error } = await client.from('player_profiles').select('xp,miles').eq('user_id', user.id).single();
      if (error) throw error;
      return { credited_miles: previousClaim.miles_earned, credited_xp: previousClaim.xp_earned, current_miles: totals.miles, current_xp: totals.xp };
    }
    const { data, error } = await client.rpc('claim_singleplayer_session', {
      claimed_session_id: claim.session_id,
      claimed_active_seconds: claim.active_seconds,
      claimed_tower_handoffs: claim.tower_handoffs,
      claimed_center_handoffs: claim.center_handoffs,
      importing_trial: !!claim.importing_trial
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  function publishClaimResult(claim, result) {
    const state = window.apcDebriefRewardState;
    if (!state || !result || state.sessionId !== claim.session_id) return;
    state.status = 'synced';
    state.earnedMiles = Number(result.credited_miles) || 0;
    state.earnedXp = Number(result.credited_xp) || 0;
    state.currentMiles = Number(result.current_miles) || 0;
    state.currentXp = Number(result.current_xp) || 0;
    state.levelUp = levelFor(state.currentXp) > Number(state.levelBefore || 1);
    state.newRank = rankFor(levelFor(state.currentXp));
    state.rankUp = state.newRank !== state.rankBefore;
    window.apcUpdateDebriefRewards?.();
  }

  async function flushClaims() {
    if (!client || !user) return;
    const claims = safeRead(CLAIMS_KEY, []);
    const remaining = [];
    for (const claim of claims) {
      if (claim.user_id !== user.id) { remaining.push(claim); continue; }
      try { const result = await sendClaim(claim); publishClaimResult(claim, result); }
      catch (error) { console.warn('Could not sync profile reward claim yet:', error); remaining.push(claim); }
    }
    safeWrite(CLAIMS_KEY, remaining);
    await readProfile();
  }

  async function importTrialProgress() {
    if (!user || !client || !trial.used || !trial.session_id || trial.imported_user_id || trialImporting) return;
    trialImporting = true;
    const claim = {
      user_id: user.id,
      session_id: trial.session_id,
      active_seconds: Math.min(1200, Math.max(0, Math.floor(trial.active_seconds))),
      tower_handoffs: Math.min(50, Math.max(0, trial.tower_handoffs | 0)),
      center_handoffs: Math.min(50, Math.max(0, trial.center_handoffs | 0)),
      importing_trial: true
    };
    try {
      await sendClaim(claim);
      trial.imported_user_id = user.id;
      safeWrite(TRIAL_KEY, trial);
      message('Free-session progress added to your profile.', 'success');
      await readProfile();
    } catch (error) {
      console.error('Trial progress import failed:', error);
      message('Your account is ready, but trial rewards could not sync yet. Check the migration and try signing in again.', 'error');
    } finally {
      trialImporting = false;
    }
  }

  async function authChanged(nextUser) {
    user = nextUser || null;
    profile = null;
    friendRows = [];
    paintProfile();
    if (!user) return;
    try {
      await readProfile();
      await importTrialProgress();
      await flushClaims();
    } catch (error) {
      console.error('Could not load player profile:', error);
      message(error.message || 'Could not load your profile. Check your connection and database migration.', 'error');
    }
  }

  function switchMode(nextMode) {
    mode = nextMode === 'signup' ? 'signup' : 'login';
    document.querySelectorAll('[data-account-mode]').forEach(button => button.classList.toggle('on', button.dataset.accountMode === mode));
    $id('accountNameField').hidden = mode !== 'signup';
    $id('accountPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $id('accountSubmit').innerHTML = mode === 'signup' ? 'CREATE ACCOUNT <strong>→</strong>' : 'SIGN IN <strong>→</strong>';
    message(trial.used ? 'Your free session is complete. Create an account to keep playing and save your trial rewards.' : 'One free session is available for up to 20 minutes. Your progress can be moved to your account afterward.');
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!client || busy) return;
    const email = $id('accountEmail').value.trim();
    const password = $id('accountPassword').value;
    const displayName = $id('accountName').value.trim();
    if (mode === 'signup' && !/^[a-zA-Z0-9_]{3,20}$/.test(displayName)) { message('Choose a username with 3–20 letters, numbers, or underscores.', 'error'); return; }
    busy = true;
    const button = $id('accountSubmit'); button.disabled = true;
    message(mode === 'signup' ? 'Creating your profile…' : 'Signing in…');
    try {
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName, username: displayName } } });
        if (error) throw error;
        if (data.session) {
          await authChanged(data.user);
          if (!trial.used) message('Account created. Your free session is still available.', 'success');
          else message('Account created. We’ll add your free-session rewards to this profile.', 'success');
        } else {
          switchMode('login');
          message('Check your email to confirm the account, then return here and sign in. Your trial progress stays on this device.', 'success');
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await authChanged(data.user);
        if (data.user) message('Signed in. Your profile is ready.', 'success');
      }
    } catch (error) {
      console.error('Account action failed:', error);
      message(error.message || 'Account request failed. Try again.', 'error');
    } finally {
      busy = false; button.disabled = false;
    }
  }

  function recordHandoffs() {
    if (!currentRun) return;
    for (const aircraft of ac) {
      if (aircraft.twr && !currentRun.towerSeen.has(aircraft.id)) {
        currentRun.towerSeen.add(aircraft.id); currentRun.towerHandoffs++;
      }
      if (aircraft.ctr && !currentRun.centerSeen.has(aircraft.id)) {
        currentRun.centerSeen.add(aircraft.id); currentRun.centerHandoffs++;
      }
    }
  }

  function updateTrialFromRun(final = false) {
    if (!currentRun || currentRun.user_id) return;
    recordHandoffs();
    trial.active_seconds = Math.min(1200, trial.active_seconds + Math.max(0, currentRun.active_seconds - currentRun.savedActiveSeconds));
    trial.tower_handoffs = Math.min(50, trial.tower_handoffs + Math.max(0, currentRun.towerHandoffs - currentRun.savedTowerHandoffs));
    trial.center_handoffs = Math.min(50, trial.center_handoffs + Math.max(0, currentRun.centerHandoffs - currentRun.savedCenterHandoffs));
    currentRun.savedActiveSeconds = currentRun.active_seconds;
    currentRun.savedTowerHandoffs = currentRun.towerHandoffs;
    currentRun.savedCenterHandoffs = currentRun.centerHandoffs;
    if (final) trial.used = true;
    safeWrite(TRIAL_KEY, trial);
  }

  async function submitRunClaim(snapshot) {
    if (!snapshot.user_id || !client) return;
    const claim = { ...snapshot, importing_trial: false };
    let result;
    try {
      result = await sendClaim(claim);
      if (!result) throw new Error('The reward service returned no claim result.');
    } catch (error) {
      const queue = safeRead(CLAIMS_KEY, []);
      if (!queue.some(item => item.session_id === claim.session_id && item.user_id === claim.user_id)) queue.push(claim);
      safeWrite(CLAIMS_KEY, queue);
      const state = window.apcDebriefRewardState;
      if (state?.sessionId === claim.session_id) {
        state.status = 'queued';
        window.apcUpdateDebriefRewards?.();
      }
      console.error('Session rewards queued for a later sync:', error);
      return;
    }
    publishClaimResult(claim, result);
    try { await readProfile(); } catch (error) { console.warn('Reward claim succeeded, but the profile refresh failed:', error); }
  }

  function endRun() {
    if (!currentRun) return null;
    recordHandoffs();
    const snapshot = {
      user_id: currentRun.user_id,
      session_id: currentRun.session_id,
      active_seconds: Math.min(currentRun.user_id ? 7200 : 1200, Math.floor(currentRun.active_seconds)),
      tower_handoffs: Math.min(50, currentRun.towerHandoffs),
      center_handoffs: Math.min(50, currentRun.centerHandoffs)
    };
    if (currentRun.user_id) {
      window.apcDebriefRewardState = {
        sessionId: snapshot.session_id,
        status: 'syncing',
        earnedMiles: null,
        earnedXp: null,
        currentMiles: null,
        currentXp: null,
        levelBefore: levelFor(Number(currentRun.startXp) || 0),
        rankBefore: rankFor(levelFor(Number(currentRun.startXp) || 0)),
        towerHandoffs: snapshot.tower_handoffs,
        centerHandoffs: snapshot.center_handoffs
      };
      void submitRunClaim(snapshot);
    } else {
      updateTrialFromRun(true);
      const totalRewards = rewardForClaim({ active_seconds: trial.active_seconds, tower_handoffs: trial.tower_handoffs, center_handoffs: trial.center_handoffs });
      window.apcDebriefRewardState = {
        sessionId: snapshot.session_id,
        status: 'trial',
        earnedMiles: totalRewards.miles,
        earnedXp: totalRewards.xp,
        currentMiles: null,
        currentXp: null,
        towerHandoffs: snapshot.tower_handoffs,
        centerHandoffs: snapshot.center_handoffs
      };
    }
    currentRun = null;
    paintDock();
    void updatePresence();
    return snapshot;
  }

  function beginRun() {
    if (!authReady) {
      showAccount();
      message('Connecting to your profile… wait a moment, then start your session.');
      return false;
    }
    const isGuest = !user;
    if (isGuest && trial.used) {
      showAccount();
      message('Your free session is complete. Sign in or create an account to keep playing.', 'error');
      return false;
    }
    if (isGuest) {
      // The guest entitlement is exactly one timed session, capped at 20 real minutes.
      if (CFG.mode !== 'TIMED') document.querySelector('[data-g="mode"][data-v="TIMED"]')?.click();
      if (Number(CFG.tm) !== 20) document.querySelector('[data-g="tm"][data-v="20"]')?.click();
    }
    const startButton = $id('go');
    const previous = startButton.__profileOriginalStart;
    if (!previous) return false;
    previous();
    const remaining = isGuest ? Math.max(1, 1200 - trial.active_seconds) : 7200;
    if (isGuest) SESS = remaining;
    currentRun = {
      user_id: user?.id || null,
      session_id: isGuest ? trial.session_id : uuid(),
      active_seconds: 0,
      towerHandoffs: 0,
      centerHandoffs: 0,
      startXp: Number(profile?.xp) || 0,
      savedActiveSeconds: 0,
      savedTowerHandoffs: 0,
      savedCenterHandoffs: 0,
      towerSeen: new Set(),
      centerSeen: new Set()
    };
    tickAt = performance.now();
    if (isGuest) { trial.used = false; safeWrite(TRIAL_KEY, trial); }
    paintDock();
    void updatePresence();
    return true;
  }

  function tick() {
    const now = performance.now();
    if (currentRun && run && sp > 0) {
      currentRun.active_seconds += Math.max(0, Math.min(2, (now - tickAt) / 1000));
      recordHandoffs();
      if (!currentRun.user_id) updateTrialFromRun(false);
    }
    tickAt = now;
  }

  function init(clientInstance, loadError) {
    if (loadError) {
      authReady = true;
      message('Account service could not load. Check your connection and reload the game.', 'error');
      console.error('Supabase client could not load:', loadError);
      return;
    }
    client = clientInstance;
    client.auth.onAuthStateChange((_event, session) => {
      user = session?.user || null;
      if (user) queueMicrotask(() => authChanged(user));
      else { profile = null; paintProfile(); }
    });
    client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      return authChanged(data.session?.user || null).finally(() => { authReady = true; });
    }).catch(error => { authReady = true; console.error('Could not restore sign-in:', error); message('Could not restore your sign-in. Try signing in again.', 'error'); });
  }

  document.querySelectorAll('[data-account-mode]').forEach(button => button.addEventListener('click', () => switchMode(button.dataset.accountMode)));
  $id('accountForm')?.addEventListener('submit', submitAuth);
  $id('usernameForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!client || !user || timeUntilUsernameChange()) return;
    const value = $id('newUsername').value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(value)) { friendMessage('Use 3–20 letters, numbers, or underscores.', 'error'); return; }
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      await rpc('change_player_username', { new_username: value });
      $id('newUsername').value = '';
      friendMessage(`Username changed to ${value}. You can change it again in 30 days.`, 'success');
      await readProfile();
    } catch (error) { friendMessage(error.message || 'Could not change username.', 'error'); }
    finally { button.disabled = !!timeUntilUsernameChange(); }
  });
  $id('friendSearchForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const value = $id('friendSearchInput').value.trim();
    const resultBox = $id('friendSearchResult');
    resultBox.innerHTML = '<div class="friend-empty">Searching…</div>';
    try {
      const matches = await rpc('find_player_by_username', { username_query: value });
      if (!matches?.length) { resultBox.innerHTML = '<div class="friend-empty">No player found. Check the username and try again.</div>'; return; }
      const result = matches[0], existing = friendRows.find(row => row.user_id === result.user_id);
      const buttonText = existing ? (existing.relation === 'friend' ? '<small>ALREADY FRIENDS</small>' : existing.relation === 'incoming' ? '<small>REQUEST RECEIVED</small>' : '<small>REQUEST SENT</small>') : `<button type="button" data-add-friend="${esc(result.username)}">SEND REQUEST</button>`;
      resultBox.innerHTML = `<article class="friend-card friend-search-card"><span class="friend-presence"></span><div class="friend-card-copy"><b>${esc(result.username)}</b><small>${esc(result.rank)} · LEVEL ${Number(result.level) || 1}</small></div>${buttonText}</article>`;
    } catch (error) { resultBox.innerHTML = ''; friendMessage(error.message || 'Could not search for that player.', 'error'); }
  });
  $id('friendSearchResult')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-add-friend]'); if (!button) return;
    button.disabled = true;
    try { await rpc('send_friend_request', { target_username: button.dataset.addFriend }); friendMessage('Friend request sent.', 'success'); await loadFriends(); button.textContent = 'REQUEST SENT'; }
    catch (error) { friendMessage(error.message || 'Could not send request.', 'error'); button.disabled = false; }
  });
  $id('friendList')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-friend-action]'); if (!button) return;
    const action = button.dataset.friendAction, target = button.dataset.friendId;
    button.disabled = true;
    try {
      if (action === 'accept') await rpc('respond_friend_request', { target_user_id: target, accept_request: true });
      else if (action === 'decline') await rpc('respond_friend_request', { target_user_id: target, accept_request: false });
      else if (action === 'remove') await rpc('remove_friend_or_request', { target_user_id: target });
      else if (action === 'block') await rpc('block_player', { target_user_id: target });
      friendMessage(action === 'block' ? 'Player blocked and removed from your friends.' : 'Friends list updated.', 'success');
      await loadFriends();
    } catch (error) { friendMessage(error.message || 'Could not update friend request.', 'error'); button.disabled = false; }
  });
  $id('presenceVisible')?.addEventListener('change', async event => {
    if (!profile) return;
    profile.presence_visible = event.target.checked;
    try { await updatePresence(); friendMessage(event.target.checked ? 'Online status is visible to friends.' : 'Your online status is hidden.', 'success'); await loadFriends(); }
    catch (error) { friendMessage(error.message || 'Could not update online visibility.', 'error'); }
  });
  $id('accountSignOut')?.addEventListener('click', async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) message(error.message, 'error');
  });

  const go = $id('go');
  if (go) { go.__profileOriginalStart = go.onclick; go.onclick = event => { event.preventDefault(); beginRun(); }; }
  const originalEnd = end;
  end = function profileAwareEnd() {
    if (!run) return originalEnd();
    const wasGuest = !user;
    endRun();
    originalEnd();
    if (wasGuest && trial.used) {
      const actions = document.querySelector('#m-rep .rep-actions');
      if (actions && !actions.querySelector('[data-create-account]')) actions.insertAdjacentHTML('afterbegin', '<button class="primary" data-go="m-account" data-create-account>CREATE ACCOUNT TO CONTINUE</button>');
    }
  };
  document.addEventListener('click', event => {
    if (event.target.closest('#profileDock')) showAccount();
  });
  document.addEventListener('click', () => setTimeout(paintDock, 0), true);
  window.addEventListener('apc-supabase-ready', event => init(event.detail?.client, event.detail?.error), { once: true });
  if (window.apcSupabase) init(window.apcSupabase);
  presenceTimer = setInterval(() => { void updatePresence(); if (user && $('#m-account')?.classList.contains('on')) void loadFriends(); }, 45000);
  window.addEventListener('pagehide', () => { if (client && user) void rpc('set_player_presence', { show_presence: false, current_activity: 'offline' }); });
  paintProfile();
  paintDock();
  setInterval(tick, 1000);
})();
