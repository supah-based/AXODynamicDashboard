'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const short = (value) => value ? `${String(value).slice(0, 8)}…${String(value).slice(-6)}` : '—';
  const number = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));
  const heatLabels = ['ICE COLD', 'FROZEN', 'VERY COLD', 'COLD', 'COOL', 'NEUTRAL', 'WARM', 'HEATING', 'HOT', 'VERY HOT', 'RED HOT ALPHA'];
  const levelThresholds = [0, 40, 100, 180, 280, 400, 550, 730, 940, 1200];
  const petLineages = new Set(['emerald_sprout', 'sapphire_tide', 'amethyst_dream', 'solar_peach', 'rose_bloom', 'midnight_mint']);
  let hatchery = null;
  let board = null;
  let profile = null;
  let referrals = null;
  let petShareCard = null;
  let xEngagementTarget = null;
  let marketPools = [];
  let marketRefreshId = 0;
  let session = { connected: false };
  let dataRefreshInFlight = false;
  let dataRefreshQueued = false;
  let hatcheryLoadState = 'idle';
  let loadedWalletAddress = null;
  let petLoadRetryTimer = null;
  let epochBoardRefreshing = false;
  let countdownTimer = null;
  let careTimer = null;
  let careInteractionPending = null;
  let careInteractionSequence = 0;
  let missionResetTarget = null;
  let missionRefreshQueued = false;
  let contractJudgmentQueue = Promise.resolve();
  const queuedProjectVotes = new Set();
  let careEntryHandled = false;
  let socialCallbackHandled = false;

  function careEntryRequested(search = window.location.search) {
    const query = new URLSearchParams(search);
    const panel = query.get('panel');
    return query.get('play') === '1' && (!panel || panel === 'care');
  }

  function focusRequestedCareEntry() {
    if (careEntryHandled || !careEntryRequested() || !hatchery?.hatched || !hatcheryDashboardAccess()) return;
    const readyAction = [...document.querySelectorAll('#pet-passport-card [data-care]')].find((button) => !button.disabled);
    const target = readyAction || $('#care-return-panel') || $('#pet-passport-card');
    if (!target) return;
    careEntryHandled = true;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    window.requestAnimationFrame(() => {
      if (!readyAction) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    });
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', 'content-type': 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({ error: 'invalid_response' }));
    if (!response.ok) {
      const error = new Error(String(body.error || body.message || 'request_failed').replaceAll('_', ' '));
      error.code = body.error;
      error.status = response.status;
      throw error;
    }
    return body;
  }

  const errorMessage = (error) => ({
    hatchery_crew_passport_required: 'Connect X and Telegram, then verify membership in the official AXO channel from the onboarding card.',
    social_identity_bundle_required: 'Connect both X and Telegram from the onboarding card first.',
    axo_telegram_membership_required: 'Join the official AXO Telegram channel and refresh membership from the onboarding card.',
    contract_alpha_daily_limit_reached: 'Today’s contract feed is complete. Your next feed unlocks at 00:00 UTC.',
    project_chain_ambiguous: 'Contract code exists on more than one supported chain. Paste its exact mainnet explorer link to choose the intended project.',
    project_chain_discovery_unavailable: 'AXO could not check every chain right now. No project was saved. Paste an exact mainnet explorer link or chain-bound ID instead.',
    project_contract_not_found: 'No deployed contract code was observed on the five supported chains. Check the address or paste its mainnet explorer link.',
    project_chain_scan_rate_limit: 'Too many chain checks from this wallet. Wait a minute, or paste an exact mainnet explorer link.',
    project_quest_already_acknowledged: 'Your wallet has already fed this contract.',
    project_already_quested: 'This contract is already in the collective feed. Use its Corroborate button.',
    contract_judgment_required: 'Choose a position on the cold-to-hot meter. The Hatchery never picks a default for you.',
    contract_conviction_required: 'Choose a position on the cold-to-hot meter.',
    contract_heat_verdict_mismatch: 'That heat position did not match the submitted call. Refresh and retry.',
    canonical_axo_scam_vote_forbidden: 'The canonical AXO onboarding call uses the heat meter; community scam removal is available only on community project rows.',
    project_community_scam_flagged: 'Three qualified Crew scam votes already removed this contract from the active list.',
    robinhood_contract_not_deployed: 'That address has no verified deployed contract on Robinhood Chain.',
    contract_verification_unavailable: 'Contract verification is temporarily unavailable. No feed was recorded.',
    feeding_cooldown_active: 'AXO is still verifying or digesting an accepted feed. The contract card shows the exact retry countdown; weekly Crew corroboration remains open.',
    social_feeding_already_claimed_today: 'That social quest is already on its 24-hour cooldown.',
    social_feeding_cooldown_active: 'That social quest is on its own 24-hour cooldown. The other social quests remain available.',
    social_post_url_already_used: 'That exact post was already used and cannot be recycled.',
    social_feeding_post_verification_required: 'AXO could not verify that post against your linked account.',
    telegram_public_post_url_required: 'Paste an exact public Telegram message URL, such as https://t.me/channel/123.',
    telegram_post_author_public_handle_required: 'Your linked Telegram account needs a public username so AXO can verify message authorship.',
    telegram_post_verification_failed: 'Telegram could not provide a public verification receipt for that message. No XP was awarded.',
    telegram_post_receipt_mismatch: 'Telegram returned a different message receipt. Check the public post URL and retry.',
    telegram_post_author_unavailable: 'Telegram did not expose a public author for that message. No XP was awarded.',
    telegram_membership_verification_unavailable: 'Telegram membership verification is temporarily unavailable. No progress was changed.',
    social_feeding_author_mismatch: 'That post was written by a different account than your linked social identity.',
    social_feeding_fresh_post_required: 'Use an original post published within the last 24 hours.',
    social_feeding_axo_reference_required: 'The post must contain useful AXO, Hatchery, or Candle Defender context.',
    social_feeding_useful_original_required: 'Add a little more useful original context before claiming this quest.',
    x_engagement_already_claimed_today: 'The AXO X support quest is already on its 24-hour cooldown.',
    x_engagement_cooldown_active: 'The AXO X support quest is on its own 24-hour cooldown. The other social quests remain available.',
    x_engagement_latest_target_required: 'AXO published a newer main-account post. Refresh and complete the current target.',
    x_engagement_attestation_required: 'Confirm that the reply link is yours, then retry.',
    x_engagement_urls_invalid: 'Open the latest AXO target and paste your direct reply link.',
    x_engagement_verification_required: 'AXO could not match the verified like and direct reply to this quest.',
    x_engagement_like_required: 'The like is not visible to X yet. Like the target post, then retry.',
    x_engagement_direct_reply_required: 'Paste a direct reply to the target AXO post.',
    x_engagement_verification_failed: 'X engagement could not be verified right now. No XP was awarded.',
    x_engagement_target_unavailable: 'The latest original @axo_rh post is temporarily unavailable. No XP was awarded.',
    reward_holding_verification_unavailable: 'AXO holding verification is temporarily unavailable. It does not block social quest XP; refresh and retry.',
    hatchery_account_suspended: 'This Hatchery account is suspended. Its existing ledgers remain preserved.',
    canonical_axo_corroboration_required: 'Complete the current AXO onboarding call. Verified historical AXO receipts are migrated automatically and never need to be repeated for daily quests.',
    social_creator_missions_paused: 'The Socials creator desk is temporarily paused. No work was recorded.',
    social_creator_already_claimed_today: 'That creator quest is already complete today.',
    social_creator_content_already_used: 'That exact creator copy was already submitted. Write a fresh original contribution.',
    social_creator_content_too_short: 'Add more original detail before saving this creator work.',
    social_creator_content_too_long: 'Shorten the creator copy to the limit shown on the card.',
    social_creator_original_work_required: 'Write at least eight meaningful words in your own voice.',
    social_creator_axo_reference_required: 'The X or Telegram creator copy must include useful AXO context.',
    social_creator_target_invalid: 'Choose an official AXO post from the list.',
    social_creator_target_verification_required: 'That official AXO post could not be verified. Refresh the list and retry.',
    crew_milestone_not_ready: 'Complete the next milestone first. Your existing progress is preserved.',
    crew_referral_expired: 'That first-touch referral expired before onboarding was completed.',
    crew_referrer_canonical_axo_required: 'The referring scout must restore their canonical AXO Crew receipt before their reward can release.',
    skill_points_exhausted: 'Your available instinct point is already used.',
    skill_level_locked: 'That instinct is not available at your current level.',
    skill_prerequisite_missing: 'Complete the earlier instinct node first.',
    first_trail_bond_required: 'Care for your AXO once before choosing a live clue.',
    first_trail_instinct_required: 'Choose your first instinct before reading the live clue.',
    first_trail_live_clue_unavailable: 'No evidence-fresh live clue is available. Nothing was recorded; refresh later.',
    first_trail_clue_changed: 'The live clue changed while you were deciding. Refresh and review the new evidence.',
    first_trail_judgment_required: 'Choose your own read for this clue.',
    first_trail_strength_required: 'Choose the strongest evidence you observed.',
    first_trail_concern_required: 'Choose the main concern or confirm that none was observed.',
  }[error?.code] || error?.message || 'Request failed.');

  const socialCallbackMessages = {
    x_oauth_authorization_denied: 'X authorization was cancelled. Nothing changed.',
    x_oauth_state_invalid_or_expired: 'The X connection expired. Start it again from this card.',
    x_oauth_token_exchange_failed: 'X accepted the login but did not return an identity receipt. Please retry.',
    x_oauth_identity_lookup_failed: 'X authorized AXO, but the account identity could not be read.',
    telegram_identity_response_invalid: 'Telegram returned an incomplete identity receipt. Please retry.',
    telegram_identity_proof_expired: 'The Telegram connection expired. Start it again from this card.',
    telegram_identity_proof_invalid: 'Telegram ownership proof did not verify. Nothing changed.',
    telegram_identity_verification_unavailable: 'Telegram verification is temporarily unavailable.',
    telegram_login_state_invalid_or_expired: 'The Telegram connection expired. Start it again from this card.',
    telegram_username_invalid: 'Telegram returned an invalid public username.',
    x_identity_already_linked: 'That X account is connected to another AXO wallet.',
    telegram_identity_already_linked: 'That Telegram account is connected to another AXO wallet.',
    x_identity_already_connected_to_this_wallet: 'That X account is already connected to this wallet.',
    telegram_identity_already_connected_to_this_wallet: 'That Telegram account is already connected to this wallet.',
    x_identity_change_requires_disconnect: 'Disconnect the current X account from Profile before connecting a different one.',
    telegram_identity_change_requires_disconnect: 'Disconnect the current Telegram account from Profile before connecting a different one.',
    wallet_session_required: 'Your wallet session expired. Reconnect the wallet and retry.',
  };

  function socialCallbackState(search = window.location.search) {
    const query = new URLSearchParams(search);
    const result = query.get('social');
    const error = query.get('social_error');
    if (result === 'x-verified') return { tone: 'success', message: 'X verified. Your next Passport step is ready below.' };
    if (result === 'telegram-verified') return {
      tone: query.get('membership') === 'verified' ? 'success' : 'info',
      message: query.get('membership') === 'verified'
        ? 'Telegram and official AXO room membership verified. Continue below.'
        : 'Telegram verified. Join the official AXO room, then press VERIFY HERE.',
    };
    if (error) return { tone: 'error', message: socialCallbackMessages[error] || `Social connection failed: ${error.replaceAll('_', ' ')}` };
    return null;
  }

  function renderSocialCallbackMessage() {
    const target = $('#onboarding-social-message');
    if (!target) return;
    const state = socialCallbackState();
    setMessage(target, state?.message || '', state?.tone || 'info');
  }

  async function startSocialConnection(platform, button) {
    const target = $('#onboarding-social-message');
    const label = platform === 'x' ? 'X' : 'Telegram';
    button.disabled = true;
    button.textContent = `OPENING ${label.toUpperCase()}…`;
    setMessage(target, `Opening secure ${label} verification…`);
    try {
      window.AxoTelemetry?.track(`${platform}_connect_started`, { surface: 'hatchery_onboarding' });
      const result = await api(`/api/hatchery/social/${platform}/connect`, { method: 'POST', body: '{}' });
      location.assign(result.authorizationUrl);
    } catch (error) {
      setMessage(target, `${label} connection could not start: ${errorMessage(error)}`, 'error');
      renderOnboarding();
    }
  }

  function heatJudgment(score) {
    const heatScore = Number(score);
    if (!Number.isInteger(heatScore) || heatScore < 0 || heatScore > 10) return null;
    return {
      heatScore,
      verdict: heatScore < 5 ? 'NOT_INTERESTING' : heatScore > 5 ? 'INTERESTING' : 'NEUTRAL',
      confidence: heatScore === 5 ? 50 : Math.abs(heatScore - 5) * 20,
      label: heatLabels[heatScore],
    };
  }

  function heatMeterMarkup({ disabled = false, includeScam = false, scamVotes = 0, scamThreshold = 3, label = 'contract' } = {}) {
    const zones = heatLabels.map((zoneLabel, score) => `<button type="button" class="heat-zone heat-${score}" data-heat-score="${score}" title="${escapeHtml(zoneLabel)} · ${score}/10" aria-label="Rate ${escapeHtml(label)} ${escapeHtml(zoneLabel)}, ${score} out of 10" ${disabled ? 'disabled' : ''}><span>${score === 5 ? 'N' : score}</span></button>`).join('');
    const scam = includeScam ? `<button type="button" class="scam-vote" data-scam-vote aria-label="Flag ${escapeHtml(label)} as a scam; ${number(scamVotes)} of ${number(scamThreshold)} qualified votes recorded" ${disabled ? 'disabled' : ''}><strong>SCAM</strong><span>${number(scamVotes)}/${number(scamThreshold)}</span></button>` : '';
    return `<div class="heat-vote-layout">${scam}<div class="heat-meter" role="group" aria-label="Cold to hot community rating"><div class="heat-meter-zones">${zones}</div><div class="heat-meter-legend" aria-hidden="true"><span>ICE COLD</span><span>NEUTRAL</span><span>RED HOT ALPHA</span></div></div></div>`;
  }

  function heatControlFor(address, canonical = false) {
    if (canonical) return $('#axo-onboarding-corroboration-form');
    return document.querySelector(`[data-corroborate-control="${String(address || '').toLowerCase()}"]`);
  }

  function setHeatControlBusy(control, busy, statusText = null) {
    if (!control) return;
    control.dataset.submitting = busy ? 'true' : 'false';
    control.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
    const status = control.querySelector('[data-heat-status]');
    if (status && statusText) status.textContent = statusText;
  }

  function advanceToNextProject(currentAddress) {
    const address = String(currentAddress || '').toLowerCase();
    const rows = $$('[data-weekly-vetting="required"]');
    if (!rows.length) return;
    const currentIndex = rows.findIndex((row) => String(row.querySelector('[data-corroborate-control]')?.dataset.corroborateControl || '').toLowerCase() === address);
    for (let offset = 1; offset <= rows.length; offset += 1) {
      const row = rows[(Math.max(0, currentIndex) + offset) % rows.length];
      const control = row?.querySelector('[data-corroborate-control]');
      const candidate = String(control?.dataset.corroborateControl || '').toLowerCase();
      const button = control?.querySelector('button:not(:disabled)');
      if (!control || !button || candidate === address || queuedProjectVotes.has(candidate) || control.dataset.submitting === 'true') continue;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      row.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      window.requestAnimationFrame(() => button.focus({ preventScroll: true }));
      return;
    }
  }

  function queueHeatSubmission(control, address, judgment, message, { canonical = false } = {}) {
    const projectAddress = String(address || '').toLowerCase();
    if (!canonical) queuedProjectVotes.add(projectAddress);
    const queuedLabel = judgment.verdict === 'SCAM' ? 'SCAM FLAG QUEUED' : `${judgment.label} · ${judgment.heatScore}/10 QUEUED`;
    setHeatControlBusy(control, true, queuedLabel);
    if (!canonical) window.requestAnimationFrame(() => advanceToNextProject(projectAddress));
    const request = contractJudgmentQueue.catch(() => null).then(async () => {
      const liveControl = heatControlFor(address, canonical) || control;
      const liveMessage = liveControl?.querySelector('[data-heat-status]') || message;
      const chosenButton = judgment.verdict === 'SCAM'
        ? liveControl?.querySelector('[data-scam-vote]')
        : liveControl?.querySelector(`[data-heat-score="${judgment.heatScore}"]`);
      setHeatControlBusy(liveControl, true, judgment.verdict === 'SCAM' ? 'RECORDING SCAM FLAG…' : `RECORDING ${judgment.label}…`);
      return submitContract(address, chosenButton, liveMessage, judgment);
    });
    contractJudgmentQueue = request.catch(() => null);
    request.then(() => {
      if (!canonical) queuedProjectVotes.delete(projectAddress);
      const liveControl = heatControlFor(address, canonical);
      if (liveControl?.dataset.submitting === 'true') setHeatControlBusy(liveControl, false);
    }, () => {
      if (!canonical) queuedProjectVotes.delete(projectAddress);
      const liveControl = heatControlFor(address, canonical);
      if (liveControl?.dataset.submitting === 'true') setHeatControlBusy(liveControl, false);
    });
    return request;
  }

  function renderHeatControl(control, { address, canonical = false, disabled = false, includeScam = false, scamVotes = 0, scamThreshold = 3, selectedScore = null, message = null, label = 'contract' } = {}) {
    if (!control) return;
    const host = control.querySelector('[data-heat-meter]');
    if (!host) return;
    host.innerHTML = heatMeterMarkup({ disabled, includeScam, scamVotes, scamThreshold, label });
    const selected = Number(selectedScore);
    if (Number.isInteger(selected) && selected >= 0 && selected <= 10) host.querySelector(`[data-heat-score="${selected}"]`)?.classList.add('selected');
    host.querySelectorAll('[data-heat-score]').forEach((button) => button.addEventListener('click', () => {
      const judgment = heatJudgment(button.dataset.heatScore);
      if (!judgment || disabled) return;
      queueHeatSubmission(control, address, judgment, message, { canonical });
    }));
    host.querySelector('[data-scam-vote]')?.addEventListener('click', (event) => {
      if (disabled) return;
      queueHeatSubmission(control, address, { verdict: 'SCAM', confidence: 100, heatScore: null, label: 'SCAM' }, message, { canonical: false });
      event.currentTarget.setAttribute('aria-pressed', 'true');
    });
  }

  function setMessage(element, message, type = '') {
    if (!element) return;
    element.textContent = message || '';
    element.className = `inline-message${type ? ` ${type}` : ''}`;
  }

  function setJourneyStep(name, state) {
    const step = document.querySelector(`[data-hatchery-step="${name}"]`);
    if (!step) return;
    if (state) step.dataset.state = state;
    else delete step.dataset.state;
    if (state === 'current') step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
  }

  function verifiedWalletAddress(value = session) {
    const address = String(value?.address || '').toLowerCase();
    return value?.connected === true && /^0x[0-9a-f]{40}$/.test(address) ? address : null;
  }

  function clearPetLoadRetry() {
    if (!petLoadRetryTimer) return;
    window.clearTimeout(petLoadRetryTimer);
    petLoadRetryTimer = null;
  }

  function resetWalletData(nextLoadState = 'idle') {
    clearPetLoadRetry();
    hideMissionHandoff();
    hatchery = null;
    board = null;
    profile = null;
    referrals = null;
    xEngagementTarget = null;
    petShareCard = null;
    loadedWalletAddress = null;
    hatcheryLoadState = nextLoadState;
  }

  function petLookupResolved() {
    const address = verifiedWalletAddress();
    return Boolean(address && hatcheryLoadState === 'ready' && loadedWalletAddress === address && hatchery);
  }

  function schedulePetLoadRetry() {
    if (petLoadRetryTimer || hatcheryLoadState !== 'error' || !verifiedWalletAddress()) return;
    petLoadRetryTimer = window.setTimeout(() => {
      petLoadRetryTimer = null;
      refreshData({ quiet: true });
    }, 2_500);
  }

  function questCompletionCount() {
    if (!hatchery?.hatched) return 0;
    return hatchery.dailyContractQuest?.completedToday === true ? 1 : 0;
  }

  function dailyContractRuntimeState() {
    const quest = hatchery?.dailyContractQuest || {};
    const completed = quest.completedToday === true;
    const accountActive = hatchery?.player?.accountStatus?.suspended !== true;
    const nextAvailableMs = Date.parse(quest.nextAvailableAt || '');
    const coolingDown = !completed && Number.isFinite(nextAvailableMs) && nextAvailableMs > Date.now();
    const cooldownExpired = quest.coolingDown === true && Number.isFinite(nextAvailableMs) && nextAvailableMs <= Date.now();
    return {
      quest,
      completed,
      accountActive,
      coolingDown,
      nextAvailableAt: coolingDown ? quest.nextAvailableAt : null,
      available: !completed && accountActive && (quest.available === true || cooldownExpired),
    };
  }

  function canonicalAxoCorroboration() {
    const server = hatchery?.canonicalAxoCorroboration;
    if (server) return server;
    return {
      required: false,
      complete: true,
      address: null,
      available: false,
      project: null,
    };
  }

  function canonicalAxoAddress() {
    const address = String(canonicalAxoCorroboration().address || '').trim().toLowerCase();
    return /^0x[0-9a-f]{40}$/.test(address) ? address : null;
  }

  function canonicalAxoComplete() {
    return canonicalAxoCorroboration().complete === true;
  }

  function canonicalAxoQuestAccessComplete() {
    const state = canonicalAxoCorroboration();
    return state.questAccessComplete === true || state.complete === true;
  }

  function onboardingPrerequisites() {
    const prerequisites = hatchery?.dailyPromotionQuest?.prerequisites || {};
    return {
      wallet: Boolean(verifiedWalletAddress()),
      hatch: hatchery?.hatched === true,
      x: prerequisites.xConnected === true,
      telegram: prerequisites.telegramConnected === true,
      member: prerequisites.axoTelegramMember === true,
      axo: hatchery?.hatched === true && canonicalAxoComplete(),
    };
  }

  function onboardingComplete() {
    const steps = onboardingPrerequisites();
    return Object.values(steps).every(Boolean);
  }

  function returningPetAccess() {
    const trail = hatchery?.player?.onboarding?.firstTrail || {};
    return hatchery?.hatched === true && trail.completed === true;
  }

  function hatcheryDashboardAccess() {
    return onboardingComplete() || returningPetAccess();
  }

  function socialIdentityBundleReady() {
    const prerequisites = hatchery?.dailyPromotionQuest?.prerequisites || {};
    return prerequisites.xConnected === true && prerequisites.telegramConnected === true;
  }

  function socialMembershipRecheckReady(quest = {}) {
    const blockedBy = Array.isArray(quest.blockedBy) ? quest.blockedBy : [];
    return quest.completedToday !== true
      && socialIdentityBundleReady()
      && canonicalAxoQuestAccessComplete()
      && blockedBy.length === 1
      && blockedBy[0] === 'axo_telegram_membership';
  }

  function socialVerificationReady(quest = {}) {
    return quest.available === true || socialMembershipRecheckReady(quest);
  }

  function nextSignalAction() {
    const feedings = Object.fromEntries((hatchery?.socialFeedings || []).map((feeding) => [feeding.platform, feeding]));
    const engagement = hatchery?.dailyXEngagement || {};
    const telegram = {
      complete: feedings.telegram?.completedToday === true,
      ready: socialVerificationReady(feedings.telegram),
      title: 'Finish your verified Telegram signal',
      copy: socialMembershipRecheckReady(feedings.telegram)
        ? 'Share fresh AXO context, then paste the direct message link. AXO rechecks official-room membership when you verify.'
        : 'Share fresh AXO context from your connected public Telegram identity, then paste the direct message link.',
      href: '/hatchery?view=quests#social-creator-telegram',
      action: 'OPEN TG QUEST ↓',
    };
    const standardActions = [
      {
        complete: engagement.completedToday === true,
        ready: socialVerificationReady(engagement) && Boolean(xEngagementTarget?.target?.postUrl),
        title: 'Finish the AXO main-post signal',
        copy: socialMembershipRecheckReady(engagement)
          ? 'Open the exact current post, like it, and reply. AXO rechecks official-room membership with the receipt.'
          : 'Open the exact current post, like it, reply directly, then paste your own reply link for platform verification.',
        href: '/hatchery?view=quests#social-creator-engagement',
        action: 'OPEN LIKE + REPLY ↓',
      },
      {
        complete: feedings.x?.completedToday === true,
        ready: socialVerificationReady(feedings.x),
        title: 'Finish your verified X signal',
        copy: socialMembershipRecheckReady(feedings.x)
          ? 'Publish fresh original AXO context, then paste the post link. AXO rechecks official-room membership when you verify.'
          : 'Publish fresh original AXO context from your connected identity, then paste the direct post link for verification.',
        href: '/hatchery?view=quests#social-creator-x',
        action: 'OPEN X QUEST ↓',
      },
      telegram,
    ];
    const progressStarted = standardActions.some((action) => action.complete);
    const actions = progressStarted && !telegram.complete
      ? [telegram, ...standardActions.filter((action) => action !== telegram)]
      : standardActions;
    return actions.find((action) => !action.complete && action.ready)
      || actions.find((action) => !action.complete)
      || {
        title: 'Review your signal receipts',
        copy: 'All available social cards are complete or waiting on their own verified cooldown.',
        href: '/hatchery?view=quests#social-creator-title',
        action: 'VIEW SIGNAL DESK ↓',
      };
  }

  function socialSectionNextAction() {
    const quest = hatchery?.dailyPromotionQuest || {};
    if (quest.complete === true) {
      return {
        state: 'complete',
        title: 'Signal run complete',
        copy: 'All three platform-verified receipts are stored. Epoch · AXO Vision will reflect verified XP; return as each card leaves its own cooldown.',
        href: 'https://www.axo.vision/epoch',
        action: 'VIEW EPOCH →',
      };
    }
    if (!socialIdentityBundleReady()) {
      const prerequisites = hatchery?.dailyPromotionQuest?.prerequisites || {};
      const missingX = prerequisites.xConnected !== true;
      return {
        state: 'setup',
        title: missingX ? 'Connect your X passport' : 'Connect your Telegram passport',
        copy: missingX
          ? 'Link X from the Hatchery onboarding card so AXO can match your verified X receipts without exposing provider IDs.'
          : 'Link Telegram from the Hatchery onboarding card so AXO can match your verified public Telegram receipts.',
        href: missingX ? '#hatchery-connect-x' : '#hatchery-connect-telegram',
        action: missingX ? 'CONNECT X ↑' : 'CONNECT TG ↑',
      };
    }
    if (!canonicalAxoQuestAccessComplete()) {
      if (!passportComplete()) {
        return {
          state: 'setup',
          title: 'Refresh your current XP pass',
          copy: 'Your Pet and earned XP remain preserved. Verify current official Telegram membership here before recording the current-AXO access call.',
          href: '#hatchery-verify-telegram-membership',
          action: 'VERIFY HERE ↑',
        };
      }
      return {
        state: 'setup',
        title: 'Finish your own current-AXO call',
        copy: 'Record your independent heat-meter judgment once. AXO never chooses or submits the call for you.',
        href: '#axo-corroboration-gate',
        action: 'MAKE YOUR CALL ↑',
      };
    }
    const next = nextSignalAction();
    return { state: next.ready === true ? 'ready' : 'waiting', ...next };
  }

  function renderSocialNextAction() {
    const panel = $('#social-next-action');
    if (!panel) return;
    const next = socialSectionNextAction();
    panel.dataset.state = next.state;
    $('#social-next-action-title').textContent = next.title;
    $('#social-next-action-copy').textContent = next.copy;
    const link = $('#social-next-action-link');
    link.href = next.href;
    link.textContent = next.action;
  }

  function continueAfterSocialReceipt() {
    renderSocialNextAction();
    return showMissionHandoff('SIGNAL RECEIPT SAVED');
  }

  function dailyCommandState() {
    const connected = Boolean(verifiedWalletAddress());
    const resolved = petLookupResolved();
    const hatched = hatchery?.hatched === true;
    const onboarding = onboardingPrerequisites();
    const setupOrder = ['wallet', 'hatch', 'x', 'telegram', 'member', 'axo'];
    const setup = {
      wallet: { title: 'Connect your wallet', copy: 'Gasless verification wakes your wallet-bound AXO Pet without moving tokens.', href: '#wallet-gate', action: 'CONNECT ABOVE ↑' },
      hatch: { title: resolved ? 'Name and hatch your AXO' : 'Loading your wallet-bound AXO', copy: resolved ? 'Choose one companion name. One verified wallet keeps one preserved AXO Pet.' : 'AXO is checking for an existing companion before showing any hatch action.', href: resolved ? '#hatch-gate' : '#pet-loading-gate', action: resolved ? 'HATCH MY AXO ↓' : 'VIEW STATUS ↓' },
      x: { title: 'Connect your X passport', copy: 'Link the public identity that will sign your verified X quest receipts.', href: '#hatchery-connect-x', action: 'CONNECT X →' },
      telegram: { title: 'Connect your Telegram passport', copy: 'Link Telegram privately so AXO can verify your own public quest receipts.', href: '#hatchery-connect-telegram', action: 'CONNECT TG →' },
      member: { title: 'Verify the official AXO room', copy: 'Join the official AXO Telegram, then refresh the existing membership receipt here without leaving Hatchery.', href: '#hatchery-verify-telegram-membership', action: 'VERIFY HERE ↓' },
      axo: { title: 'Record your current AXO call', copy: 'Choose your own cold-to-hot position. AXO never selects a judgment for you.', href: '#axo-corroboration-gate', action: 'MAKE YOUR CALL ↓' },
    };
    const missingSetup = setupOrder.find((step) => !onboarding[step]);
    if (!connected || !resolved || !hatched || missingSetup) {
      return {
        state: !connected ? 'connect' : !resolved ? 'loading' : !hatched ? 'hatch' : 'onboarding',
        completed: 0,
        loops: {},
        next: setup[missingSetup || (!connected ? 'wallet' : 'hatch')],
        summary: hatched ? 'Finish the Crew passport once; then AXO will route the best care, scout, signal, or vetting action every day.' : 'Connect, hatch once, and AXO will route the most useful verified action available now.',
      };
    }

    const firstLoop = hatchery?.player?.onboarding || {};
    if (firstLoop.complete !== true) {
      const firstLoopNext = {
        BOND: { title: 'Start the First Trail with care', copy: 'Play, rest, or train once. That saved care receipt unlocks your starter instinct.', href: '#pet-passport-card', action: 'CARE FOR AXO ↓' },
        INSTINCT: { title: 'Choose your starter instinct', copy: 'Pick one existing evidence route. This is a permanent Pet skill choice, not a trading preference.', href: '#first-loop-instinct', action: 'CHOOSE INSTINCT ↓' },
        CLUE: { title: 'Read one live evidence clue', copy: 'Make your own three-part provisional label. It cannot alter trust, safety, ranking, or execution.', href: '#first-loop-form', action: 'READ LIVE CLUE ↓' },
        WAITING_FOR_CLUE: { title: 'Wait for an evidence-fresh clue', copy: 'AXO will not invent a training target. Refresh when Live Radar has a current contract-shaped clue.', href: '#first-loop-card', action: 'VIEW FIRST TRAIL ↓' },
      };
      return {
        state: 'first-trail',
        completed: 0,
        loops: {},
        next: firstLoopNext[firstLoop.status] || firstLoopNext.BOND,
        summary: 'Your Crew Passport is ready. Complete the preserved First Trail once, then the deck advances to daily care, scout, signal, and Crew loops.',
      };
    }

    const care = hatchery?.player?.care?.dailyRitual || {};
    const careDone = care.complete === true;
    const careProgress = `${number(care.completed || 0)} / ${number(care.goal || 3)}`;
    const nextCareAction = nextCareReceiptAction(hatchery?.player?.care, true);
    const nextCareLabel = nextCareAction ? `${nextCareAction[0].toUpperCase()}${nextCareAction.slice(1)}` : null;
    const scout = dailyContractRuntimeState();
    const scoutDone = scout.completed;
    const social = hatchery?.dailyPromotionQuest || {};
    const signalDone = social.complete === true;
    const signalProgress = `${number(social.completed || 0)} / ${number(social.goal || 3)}`;
    const canonicalAxo = canonicalAxoAddress();
    const activeCrew = (hatchery?.projectQuests || []).filter((project) => (
      String(project.address || '').toLowerCase() !== canonicalAxo
      && project.accepting !== false
      && Date.parse(project.expiresAt || 0) > Date.now()
    ));
    const crewDoneCount = activeCrew.filter((project) => project.completedByPlayer === true).length;
    const crewDone = activeCrew.length === 0 || crewDoneCount === activeCrew.length;
    const loops = {
      care: { done: careDone, status: careDone ? 'COMPLETE ✓' : `${careProgress} TODAY` },
      scout: { done: scoutDone, status: scoutDone ? 'COMPLETE ✓' : scout.coolingDown ? `READY IN ${missionCountdown(scout.nextAvailableAt)}` : scout.available ? '1 READY' : 'SETUP' },
      signal: { done: signalDone, status: signalDone ? 'COMPLETE ✓' : `${signalProgress} TODAY` },
      crew: { done: crewDone, status: crewDone ? 'COMPLETE ✓' : `${number(activeCrew.length - crewDoneCount)} TO VET` },
    };
    const signalNext = nextSignalAction();
    const signalCandidate = !signalDone && { ...signalNext, copy: `${signalProgress} social quests are complete. ${signalNext.copy}` };
    const signalInProgress = !signalDone && Number(social.completed || 0) > 0;
    const candidates = [
      signalInProgress && signalCandidate,
      !careDone && {
        title: nextCareLabel ? `${nextCareLabel} with your AXO next` : 'Finish your care ritual',
        copy: nextCareLabel
          ? `${careProgress} care moves are complete. ${nextCareLabel} is the next server-ordered ready receipt; AXO will focus it without clicking or submitting anything.`
          : `${careProgress} care moves are complete. Open the Pet Passport to review the remaining verified action.`,
        href: '/hatchery?play=1&panel=care',
        action: nextCareLabel ? `OPEN ${nextCareLabel.toUpperCase()} ↓` : 'CARE FOR AXO ↓',
      },
      !scoutDone && scout.available && { title: 'Open one Crew discovery window', copy: 'Tag one exact deployed Robinhood Chain contract. AXO verifies the contract before any XP receipt.', href: '#daily-title', action: 'SCOUT A CONTRACT ↓' },
      !signalInProgress && signalCandidate,
      !crewDone && { title: 'Add your independent Crew call', copy: `${number(activeCrew.length - crewDoneCount)} active project${activeCrew.length - crewDoneCount === 1 ? '' : 's'} still need your weekly cold-to-hot judgment.`, href: '#contracts-title', action: 'VET PROJECTS ↓' },
      !scoutDone && scout.coolingDown && { title: 'Let the accepted feed finish digesting', copy: `The next new-contract tag opens in ${missionCountdown(scout.nextAvailableAt)}. Weekly Crew corroboration stays available during this timer.`, href: '#contracts-title', action: 'VET WHILE IT DIGESTS ↓' },
    ].filter(Boolean);
    const completed = Object.values(loops).filter((loop) => loop.done).length;
    return {
      state: completed === 4 ? 'complete' : 'active',
      completed,
      loops,
      next: candidates[0] || { title: 'Daily loop complete', copy: 'Your verified care, scout, signal, and Crew receipts are in. Return after the next cooldown or UTC reset.', href: 'https://www.axo.vision/epoch', action: 'VIEW EPOCH →' },
      summary: completed === 4 ? 'All four verified loops are complete. Your AXO can rest while Epoch · AXO Vision updates.' : 'AXO picked the shortest verified path to useful progress. Complete it, then the deck advances.',
    };
  }

  function renderDailyCommand() {
    const card = $('#daily-command');
    if (!card) return;
    const command = dailyCommandState();
    card.dataset.state = command.state;
    $('#daily-command-summary').textContent = command.summary;
    $('#daily-command-count').textContent = `${number(command.completed)} / 4 LOOPS`;
    $('#daily-command-progress').style.width = `${Math.round(command.completed / 4 * 100)}%`;
    $('#daily-command-next-title').textContent = command.next.title;
    $('#daily-command-next-copy').textContent = command.next.copy;
    const nextLink = $('#daily-command-next-link');
    nextLink.href = command.next.href;
    nextLink.textContent = command.next.action;
    ['care', 'scout', 'signal', 'crew'].forEach((loopName) => {
      const element = card.querySelector(`[data-command-loop="${loopName}"]`);
      const loop = command.loops[loopName];
      element.dataset.state = loop?.done ? 'complete' : command.state === 'active' ? 'ready' : command.state === 'complete' ? 'complete' : 'locked';
      element.querySelector('[data-command-status]').textContent = loop?.status || 'LOCKED';
    });
  }

  function renderCrewPulse() {
    const card = $('#crew-pulse');
    if (!card) return;
    const connected = Boolean(verifiedWalletAddress());
    const hatched = hatchery?.hatched === true;
    card.hidden = !connected || !hatched || !hatcheryDashboardAccess();
    if (card.hidden) return;
    const canonicalAxo = canonicalAxoAddress();
    const activeProjects = (hatchery?.projectQuests || []).filter((project) => (
      String(project.address || '').toLowerCase() !== canonicalAxo
      && project.accepting !== false
      && Date.parse(project.expiresAt || 0) > Date.now()
    ));
    const completed = activeProjects.filter((project) => project.completedByPlayer === true).length;
    const needed = Math.max(0, activeProjects.length - completed);
    const epochId = hatchery?.ledger?.currentEpochId || activeProjects[0]?.epoch?.id || 'CURRENT EPOCH';
    $('#crew-pulse-epoch').textContent = epochId;
    $('#crew-pulse-open').textContent = number(activeProjects.length);
    $('#crew-pulse-done').textContent = number(completed);
    $('#crew-pulse-needed').textContent = number(needed);
    const command = dailyCommandState();
    const next = !['active', 'complete'].includes(command.state)
      ? { label: 'FINISH SETUP FIRST', title: command.next.title, copy: command.next.copy, href: command.next.href, action: command.next.action }
      : needed > 0
        ? { label: 'COMMUNITY NEXT MOVE', title: `Add your call to ${number(needed)} open project${needed === 1 ? '' : 's'}.`, copy: 'Your independent cold-to-hot judgment is saved once for the current epoch and never becomes an automatic safety or trading verdict.', href: '/hatchery?view=quests#contracts-title', action: 'VET PROJECTS →' }
        : activeProjects.length > 0
          ? { label: 'YOUR CREW ROUND IS COMPLETE', title: 'Every current project has your saved call.', copy: 'Review verified Epoch progress or return when a new independent project window opens.', href: 'https://www.axo.vision/epoch', action: 'VIEW EPOCH →' }
          : { label: 'CREW MAP STATUS', title: 'No project window is accepting calls right now.', copy: 'Your existing receipts remain preserved. The Command Deck will surface the next available verified action.', href: '#daily-command', action: 'VIEW NEXT MOVE →' };
    $('#crew-pulse-label').textContent = next.label;
    $('#crew-pulse-action-title').textContent = next.title;
    $('#crew-pulse-action-copy').textContent = next.copy;
    const link = $('#crew-pulse-action-link');
    link.href = next.href;
    link.textContent = next.action;
  }

  function hideMissionHandoff() {
    const panel = $('#mission-handoff');
    if (panel) panel.hidden = true;
  }

  function showMissionHandoff(receiptLabel = 'VERIFIED RECEIPT SAVED') {
    const panel = $('#mission-handoff');
    if (!panel || !hatchery?.hatched) return null;
    renderDailyCommand();
    const command = dailyCommandState();
    const next = command.next;
    if (!next?.title || !next?.href || !next?.action) return null;
    $('#mission-handoff-receipt').textContent = String(receiptLabel || 'VERIFIED RECEIPT SAVED').toUpperCase();
    $('#mission-handoff-title').textContent = next.title;
    $('#mission-handoff-copy').textContent = next.copy;
    const link = $('#mission-handoff-link');
    link.href = next.href;
    link.textContent = next.action;
    panel.dataset.state = command.state;
    panel.hidden = false;
    return { title: next.title, action: next.action, href: next.href };
  }

  function renderOnboarding() {
    const card = $('#onboarding-card');
    if (!card) return;
    const steps = onboardingPrerequisites();
    const order = ['wallet', 'hatch', 'x', 'telegram', 'member', 'axo'];
    const completed = order.filter((name) => steps[name]).length;
    const current = order.find((name) => !steps[name]);
    const returningNeedsRefresh = returningPetAccess() && !steps.member;
    card.hidden = completed === order.length;
    $('#onboarding-title').textContent = returningNeedsRefresh ? 'Your First Trail is saved. Refresh the XP pass.' : 'Get your AXO ready for the Hatchery.';
    $('#onboarding-copy').textContent = returningNeedsRefresh
      ? 'Your pet, First Trail, and earned XP stay preserved. Refresh official Telegram membership to unlock XP-bearing actions; zero-XP Cuddle remains available.'
      : 'Name your pet, connect both social accounts, verify the official Telegram channel, and record your own current-AXO call. Every check comes from wallet-private server evidence.';
    order.forEach((name, index) => {
      const element = card.querySelector(`[data-onboarding-step="${name}"]`);
      if (!element) return;
      const unlocked = index === 0 || order.slice(0, index).every((prior) => steps[prior]);
      const state = steps[name] ? 'complete' : unlocked ? 'current' : 'locked';
      element.dataset.state = state;
      const status = element.querySelector('[data-onboarding-status]');
      if (status) status.textContent = steps[name] ? 'VERIFIED ✓' : unlocked ? 'DO THIS NOW' : 'LOCKED';
      if (name === 'member') {
        const verifyButton = element.querySelector('#hatchery-verify-telegram-membership');
        if (verifyButton) {
          verifyButton.disabled = steps.member || !steps.telegram;
          verifyButton.textContent = steps.member ? 'VERIFIED ✓' : 'VERIFY HERE';
        }
      }
      if (name === 'x' || name === 'telegram') {
        const connectButton = element.querySelector('.onboarding-connect-action');
        if (connectButton) {
          connectButton.disabled = steps[name] || !unlocked || !verifiedWalletAddress();
          connectButton.textContent = steps[name] ? 'VERIFIED ✓' : name === 'x' ? 'CONNECT X →' : 'CONNECT TG →';
        }
      }
    });
    card.dataset.state = completed === order.length ? 'complete' : verifiedWalletAddress() ? 'active' : 'waiting';
    $('#onboarding-progress-count').textContent = returningNeedsRefresh ? `${completed} / ${order.length} CURRENT XP PASS` : `${completed} / ${order.length} READY`;
    $('#onboarding-progress-bar').style.width = `${Math.round(completed / order.length * 100)}%`;
    const labels = {
      wallet: 'CONNECT YOUR WALLET', hatch: 'NAME YOUR AXO PET', x: 'CONNECT YOUR X ACCOUNT', telegram: 'CONNECT YOUR TELEGRAM ACCOUNT',
      member: returningNeedsRefresh ? 'REFRESH MEMBERSHIP · FIRST TRAIL KEPT' : 'JOIN AND VERIFY THE AXO TELEGRAM', axo: 'SUBMIT YOUR CURRENT AXO CALL',
    };
    $('#onboarding-progress-label').textContent = current ? labels[current] : 'PET PASSPORT READY';
    renderSocialCallbackMessage();
  }

  function continueAfterSocialCallback() {
    if (socialCallbackHandled || !socialCallbackState() || !hatchery?.hatched) return null;
    const current = $('#onboarding-card [data-state="current"]');
    const target = current?.querySelector('.onboarding-connect-action:not(:disabled), #hatchery-verify-telegram-membership:not(:disabled), button[data-heat-score]:not(:disabled), a');
    if (!target) return null;
    socialCallbackHandled = true;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => target.focus({ preventScroll: true }), reduceMotion ? 0 : 350);
    const clean = new URL(window.location.href);
    ['social', 'social_error', 'membership'].forEach((key) => clean.searchParams.delete(key));
    window.history.replaceState({}, '', `${clean.pathname}${clean.search}${clean.hash}`);
    return current.dataset.onboardingStep || null;
  }

  function membershipContinuation(steps = onboardingPrerequisites()) {
    if (steps.member !== true) return null;
    return steps.axo === true ? 'DAILY_COMMAND' : 'AXO_CALL';
  }

  function continueAfterMembershipRefresh() {
    const continuation = membershipContinuation();
    const gate = continuation === 'AXO_CALL' ? $('#axo-corroboration-gate') : null;
    const target = continuation === 'AXO_CALL'
      ? gate?.querySelector('button[data-heat-score]:not(:disabled)')
      : continuation === 'DAILY_COMMAND'
        ? $('#daily-command-next-link')
        : null;
    if (!target || (gate && gate.hidden)) return continuation;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => target.focus({ preventScroll: true }), reduceMotion ? 0 : 350);
    return continuation;
  }

  const trailLabel = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  function populateTrailSelect(select, values) {
    const current = select.value;
    select.innerHTML = '<option value="">CHOOSE…</option>' + (Array.isArray(values) ? values : []).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(trailLabel(value))}</option>`).join('');
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function renderFirstLoop() {
    const card = $('#first-loop-card');
    if (!card || !hatchery?.hatched) return;
    const onboarding = hatchery.player?.onboarding || {};
    const trailSteps = Object.fromEntries((onboarding.trailSteps || []).map((step) => [step.id, step.complete === true]));
    const status = onboarding.complete === true ? 'COMPLETED' : onboarding.status || 'BOND';
    card.dataset.state = status.toLowerCase().replaceAll('_', '-');
    $('#first-loop-status').textContent = status === 'COMPLETED' ? 'FIRST LOOP COMPLETE ✓' : `NEXT · ${trailLabel(status).toUpperCase()}`;
    ['care', 'skill', 'expedition'].forEach((name, index, order) => {
      const step = card.querySelector(`[data-first-loop-step="${name}"]`);
      const complete = trailSteps[name] === true;
      const unlocked = index === 0 || order.slice(0, index).every((prior) => trailSteps[prior] === true);
      step.dataset.state = complete ? 'complete' : unlocked ? 'current' : 'locked';
      step.querySelector('[data-first-loop-step-status]').textContent = complete ? 'VERIFIED ✓' : unlocked ? 'DO THIS NOW' : 'LOCKED';
    });
    $('#first-loop-care').hidden = status !== 'BOND';
    $('#first-loop-instinct').hidden = status !== 'INSTINCT';
    $('#first-loop-form').hidden = !['CLUE', 'WAITING_FOR_CLUE'].includes(status);
    const instinctOptions = $('#first-loop-instinct-options');
    instinctOptions.innerHTML = (onboarding.instinctNodes || []).map((node) => `<button type="button" data-first-instinct="${escapeHtml(node.id)}" ${node.selected || status !== 'INSTINCT' ? 'disabled' : ''}><span>${escapeHtml(node.icon || '⌁')}</span><b>${escapeHtml(node.label)}</b><small>${escapeHtml(node.description)}</small></button>`).join('');
    instinctOptions.querySelectorAll('[data-first-instinct]:not(:disabled)').forEach((button) => button.addEventListener('click', async () => {
      try {
        await mutate('/api/hatchery/skills', { skillId: button.dataset.firstInstinct }, button, $('#first-loop-message'), 'Saving your starter instinct…');
        setMessage($('#first-loop-message'), 'Instinct saved. Review the live clue next.', 'success');
      } catch { /* mutate rendered the error */ }
    }));
    const clue = onboarding.clue;
    const form = $('#first-loop-form');
    form.querySelector('button').disabled = !clue || status !== 'CLUE';
    $('#first-loop-clue-summary').textContent = clue
      ? `${clue.candidate?.symbol || clue.candidate?.name || 'LIVE CONTRACT'} · ${short(clue.candidate?.address)}. Choose only what the displayed evidence supports.`
      : 'No evidence-fresh Robinhood Chain clue is available. AXO will not create a training label without one.';
    $('#first-loop-clue-evidence').textContent = clue ? `${String(clue.source || 'AXO_LIVE_RADAR').replaceAll('_', ' ')} · OBSERVED ${new Date(clue.observedAt).toLocaleString()}` : 'WAITING FOR LIVE RADAR · NOTHING RECORDED';
    populateTrailSelect(form.elements.judgment, clue?.choices?.judgments);
    populateTrailSelect(form.elements.strength, clue?.choices?.strengths);
    populateTrailSelect(form.elements.concern, clue?.choices?.concerns);
  }

  function renderJourney() {
    const connected = Boolean(verifiedWalletAddress());
    const resolved = petLookupResolved();
    const hatched = hatchery?.hatched === true;
    const passportReady = hatched && passportComplete();
    const axoReady = passportReady && canonicalAxoQuestAccessComplete();
    const questsDone = questCompletionCount();
    setJourneyStep('wallet', connected ? 'complete' : 'current');
    setJourneyStep('hatch', !connected ? null : resolved && hatched ? 'complete' : 'current');
    setJourneyStep('passport', !hatched ? null : passportReady ? 'complete' : 'current');
    setJourneyStep('axo', !passportReady ? null : axoReady ? 'complete' : 'current');
    setJourneyStep('quests', !axoReady ? null : questsDone === 1 ? 'complete' : 'current');
  }

  function syncMobilePetControllerState() {
    const controller = $('[data-mobile-pet-controller]');
    if (!controller) return;
    const connected = Boolean(verifiedWalletAddress());
    const resolved = petLookupResolved();
    const hatched = hatchery?.hatched === true;
    const pet = hatchery?.pet || {};
    controller.dataset.petState = !connected ? 'connect' : !resolved ? 'loading' : hatched ? 'ready' : 'hatch';
    const name = !connected ? 'CONNECT WALLET' : !resolved ? 'LOADING YOUR AXO' : hatched ? (pet.name || 'YOUR AXO') : 'READY TO HATCH';
    const status = !connected ? 'CONNECT TO WAKE YOUR AXO' : !resolved ? 'CHECKING VERIFIED WALLET BINDING' : hatched ? `${String(pet.stage || 'HATCHLING').toUpperCase()} · LEVEL ${number(pet.level || 1)}` : 'NAME YOUR AXO TO UNLOCK CARE';
    controller.querySelectorAll('[data-mobile-pet-name]').forEach((element) => { element.textContent = name; });
    controller.querySelectorAll('[data-mobile-pet-status]').forEach((element) => { element.textContent = status; });
    controller.querySelectorAll('[data-mobile-pet-portrait]').forEach((image) => {
      image.src = hatched ? currentPetArtwork() : '/hatchery-assets/hacker-v3/states/axo-pet-egg-v3.webp';
      image.alt = hatched ? `${name}, your AXO companion` : '';
    });
    if (!hatched) controller.querySelectorAll('[data-mobile-pet-action]').forEach((button) => {
      button.disabled = true;
      button.classList.remove('ready');
      button.title = connected && !resolved ? 'Loading your wallet-bound AXO Pet' : connected ? 'Hatch your AXO to unlock care' : 'Connect your wallet to unlock care';
      const timer = button.querySelector('[data-care-timer]');
      if (timer) timer.textContent = 'LOCKED';
    });
  }

  function setMobilePetControllerOpen(open) {
    const controller = $('[data-mobile-pet-controller]');
    if (!controller) return;
    const expanded = open === true && window.matchMedia('(max-width: 800px)').matches;
    controller.dataset.open = String(expanded);
    controller.querySelector('[data-mobile-pet-toggle]')?.setAttribute('aria-expanded', String(expanded));
    const drawer = controller.querySelector('.mobile-pet-control-drawer');
    drawer?.setAttribute('aria-hidden', String(!expanded));
    if (drawer) drawer.inert = !expanded;
    document.body.classList.toggle('mobile-pet-controller-open', expanded);
  }

  function setupMobilePetController() {
    const controller = $('[data-mobile-pet-controller]');
    if (!controller || document.documentElement.dataset.axoPetHost !== 'true') return;
    controller.querySelector('[data-mobile-pet-toggle]')?.addEventListener('click', () => setMobilePetControllerOpen(true));
    controller.querySelectorAll('[data-mobile-pet-close]').forEach((button) => button.addEventListener('click', () => setMobilePetControllerOpen(false)));
    controller.querySelectorAll('[data-mobile-pet-link]').forEach((link) => link.addEventListener('click', () => setMobilePetControllerOpen(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && controller.dataset.open === 'true') setMobilePetControllerOpen(false);
    });
    window.matchMedia('(max-width: 800px)').addEventListener?.('change', (event) => {
      if (!event.matches) setMobilePetControllerOpen(false);
    });
    const requestedState = new URLSearchParams(window.location.search).get('controls');
    if (requestedState === 'open') setMobilePetControllerOpen(true);
    syncMobilePetControllerState();
  }

  function setConnectedState() {
    const pill = $('.wallet-pill');
    const connected = Boolean(verifiedWalletAddress());
    const resolved = petLookupResolved();
    const hatched = resolved && hatchery?.hatched === true;
    const canHatch = resolved && hatchery?.hatched === false;
    pill.classList.toggle('connected', connected);
    $$('[data-wallet-status]').forEach((element) => {
      element.textContent = connected ? short(session.address) : 'CONNECT IN THE HEADER';
    });
    $('#wallet-gate').hidden = connected;
    const loadingGate = $('#pet-loading-gate');
    loadingGate.hidden = !connected || resolved;
    loadingGate.dataset.state = hatcheryLoadState;
    loadingGate.setAttribute('aria-busy', String(connected && hatcheryLoadState !== 'error' && !resolved));
    $('#pet-loading-title').textContent = hatcheryLoadState === 'error' ? 'Still looking for your AXO Pet' : 'Loading your AXO Pet…';
    $('#pet-loading-message').textContent = hatcheryLoadState === 'error'
      ? 'The verified wallet lookup did not complete. No new-pet option will be shown until the existing-pet check succeeds; AXO is retrying automatically.'
      : 'Checking this verified wallet for its preserved Hatchery companion before any hatch option is shown.';
    $('#pet-loading-retry').hidden = hatcheryLoadState !== 'error';
    $('#hatch-gate').hidden = !canHatch;
    $('#dashboard-content').hidden = !hatched || !hatcheryDashboardAccess();
    const hatchButton = $('#hatch-form button[type="submit"]');
    if (hatchButton) hatchButton.disabled = !canHatch;
    renderJourney();
    renderOnboarding();
    renderDailyCommand();
    renderCrewPulse();
    syncMobilePetControllerState();
  }

  function passportComplete() {
    return hatchery?.player?.participation?.complete === true || hatchery?.dailyPromotionQuest?.prerequisitesMet === true;
  }

  function renderPassport() {
    const gate = hatchery.player?.participation || {};
    const prerequisites = hatchery.dailyPromotionQuest?.prerequisites || {};
    $('#passport-status').textContent = gate.complete ? 'READY FOR XP' : 'SETUP REQUIRED';
    const items = [
      ['#passport-x', prerequisites.xConnected],
      ['#passport-tg', prerequisites.telegramConnected],
      ['#passport-member', prerequisites.axoTelegramMember],
    ];
    for (const [selector, complete] of items) $(selector).classList.toggle('complete', complete === true);
    $('#pet-passport-ready').textContent = onboardingComplete() ? 'VERIFIED' : returningPetAccess() ? 'REFRESH FOR XP' : 'ONBOARDING';
    renderOnboarding();
    renderJourney();
  }

  function renderCanonicalAxoCorroboration() {
    const state = canonicalAxoCorroboration();
    const canonicalAxo = canonicalAxoAddress();
    const passportReady = passportComplete();
    const migrated = state.migrated === true && state.complete !== true;
    const card = $('#axo-corroboration-gate');
    const control = $('#axo-onboarding-corroboration-form');
    card.hidden = state.required !== true;
    const journeyStep = document.querySelector('[data-hatchery-step="axo"]');
    if (journeyStep) journeyStep.hidden = state.required !== true;
    card.dataset.state = state.complete ? 'complete' : !passportReady || !canonicalAxo ? 'locked' : migrated ? 'migrated' : 'ready';
    $('#axo-corroboration-status').textContent = state.complete ? 'CURRENT AXO VERIFIED' : !canonicalAxo ? 'SYNC REQUIRED' : !passportReady ? 'PASSPORT FIRST' : migrated ? 'QUEST ACCESS MIGRATED' : 'REQUIRED';
    $('#axo-corroboration-crew').textContent = !canonicalAxo ? 'CURRENT AXO ADDRESS UNAVAILABLE' : !passportReady ? 'CHANNEL MEMBERSHIP REQUIRED' : migrated ? 'CURRENT CALL NEEDED FOR REFERRALS' : `${number(state.project?.feedCount || 0)} CREW · PINNED`;
    const heatStatus = control.querySelector('[data-heat-status]');
    const locked = state.complete || !canonicalAxo || !passportReady || state.available === false;
    renderHeatControl(control, {
      address: canonicalAxo,
      canonical: true,
      disabled: locked,
      selectedScore: state.project?.userJudgment?.heatScore,
      message: $('#axo-corroboration-message'),
      label: 'current AXO',
    });
    if (heatStatus) heatStatus.textContent = state.complete
      ? `CALL RECORDED · ${heatLabels[Number(state.project?.userJudgment?.heatScore)] || String(state.project?.userJudgment?.verdict || 'DONE').replaceAll('_', ' ')}`
      : !canonicalAxo ? 'REFRESH AXO STATUS' : !passportReady ? 'COMPLETE PASSPORT FIRST' : migrated ? 'TAP A HEAT POSITION TO ADD YOUR CURRENT CALL' : 'TAP ONCE TO RECORD YOUR CALL';
    renderOnboarding();
    renderJourney();
  }

  function formatWholeAxo(raw) {
    try { return new Intl.NumberFormat('en-US').format(BigInt(String(raw || '0')) / (10n ** 18n)); }
    catch { return null; }
  }

  function renderReferralRewardPolicy() {
    const policy = $('#referral-token-policy');
    if (!policy) return;
    const reward = referrals?.axoPurchaseReward || {};
    const onchain = reward.onchain || {};
    const contract = onchain.contract || {};
    const campaign = onchain.campaign || {};
    const global = onchain.global || {};
    const live = contract.status === 'LIVE'
      && contract.verified === true
      && contract.tokenBindingCurrent === true
      && contract.claimsEnabled === true
      && contract.custodyEnabled === true;
    if (live) {
      const minimum = formatWholeAxo(campaign.minimumPurchaseRaw || contract.minimumPurchaseRaw);
      const amount = formatWholeAxo(campaign.rewardPerReferralRaw || contract.currentRewardPerReferralRaw);
      const capacity = Number.isSafeInteger(Number(global.fundedReferralCapacity)) ? number(global.fundedReferralCapacity) : '—';
      const days = Number.isSafeInteger(Number(contract.claimMaturationSeconds)) ? Math.floor(Number(contract.claimMaturationSeconds) / 86_400) : null;
      policy.textContent = `Referral Rewards V4 is live and funded. A qualifying new-wallet buyer completes Crew onboarding and receives at least ${minimum || 'the verified minimum'} AXO in one verified onboarding purchase; the referrer’s registered ${amount || 'current'} AXO reward matures for ${days || 'the configured'} days, and both wallets must hold ${minimum || 'the verified minimum'} AXO at claim time. Current funded capacity: ${capacity}. Claims are self-custody; AXO never claims for the user.`;
      return;
    }
    if (!referrals || contract.status === 'READ_UNAVAILABLE') {
      policy.textContent = 'Referral Rewards V4 status is temporarily unavailable. No funding, capacity, reward, or claim state is inferred here; use the Referral Control Room for the latest verified read.';
      return;
    }
    policy.textContent = `Referral Rewards V4 is currently ${String(contract.status || reward.status || 'NOT VERIFIED').replaceAll('_', ' ')}. Existing referral and XP records remain preserved; no claim-ready state is inferred without a fresh verified contract read.`;
  }

  function renderReferrals() {
    const own = referrals?.own || {};
    const link = $('#referral-link');
    link.value = own.link || 'Referral link unavailable';
    $('#referral-copy').disabled = !own.link;
    $('#referral-stats').textContent = `${number(own.activated || 0)} ACTIVATED · ${number(own.purchaseReceipts || 0)} VERIFIED PURCHASES`;
    const inbound = referrals?.inbound || null;
    const inboundCard = $('#referral-inbound');
    inboundCard.hidden = !inbound;
    if (inbound) {
      const epochReleased = inbound.claim?.claimantEpochXp === 'RELEASED';
      $('#referral-inbound-status').textContent = epochReleased ? 'PET + EPOCH XP RELEASED' : String(inbound.status || 'PENDING_ACTIVATION').replaceAll('_', ' ');
      const button = $('#referral-activate');
      button.disabled = epochReleased || !passportComplete() || !canonicalAxoComplete();
      button.textContent = epochReleased ? 'REFERRAL XP RELEASED ✓' : 'ACTIVATE REFERRAL XP';
    }
    renderReferralRewardPolicy();
    renderPetShare();
  }

  function renderPetShare() {
    const maker = $('#pet-passport');
    const result = $('#pet-share-result');
    const create = $('#pet-share-create');
    create.disabled = !hatchery?.hatched || maker.dataset.loading === 'true';
    result.hidden = !petShareCard;
    if (!petShareCard) return;
    $('#pet-share-preview').src = petShareCard.imageUrl;
    $('#pet-share-preview').alt = `${petShareCard.pet?.name || 'AXO'} Pet Passport preview`;
    $('#pet-share-link').value = petShareCard.url;
    $('#pet-share-x').href = petShareCard.xShareUrl;
    $('#pet-share-telegram').href = petShareCard.telegramShareUrl;
    $('#pet-share-download').href = petShareCard.downloadUrl;
    $('#pet-share-download').download = `axo-pet-${petShareCard.shareCode}.jpg`;
  }

  function currentPetArtwork() {
    const lineage = String(hatchery?.pet?.lineage?.id || hatchery?.pet?.visual?.lineageId || '').toLowerCase();
    const level = Math.max(1, Math.min(10, Number(hatchery?.pet?.level || hatchery?.pet?.visual?.growthLevel || 1)));
    if (petLineages.has(lineage)) {
      const root = level === 10 ? '/hatchery-nft-v5' : '/hatchery-nft-v5.1.1';
      return `${root}/pet_${lineage}_l${String(level).padStart(2, '0')}.webp`;
    }
    const serverAsset = String(hatchery?.pet?.visual?.asset || '');
    return /^(?:\/hatchery-nft-v5\.1\.1\/pet_[a-z0-9_]+_l0[1-9]|\/hatchery-nft-v5\/pet_[a-z0-9_]+_l(?:0[1-9]|10))\.webp$/.test(serverAsset)
      ? serverAsset
      : '/hatchery-nft-v5.1.1/pet_emerald_sprout_l01.webp';
  }

  function renderCurrentPetArtwork() {
    if (!hatchery?.hatched) return;
    const artwork = currentPetArtwork();
    const portrait = $('#pet-portrait');
    portrait.src = artwork;
    portrait.alt = `${hatchery.pet?.name || 'AXO'}, your AXO companion`;
    $('#hatchery-hero-pet').src = artwork;
    portrait.hidden = false;
  }

  function renderPet() {
    const pet = hatchery.pet;
    $('#pet-name').textContent = pet.name;
    $('#pet-lineage').textContent = `${pet.lineage?.label || 'AXO'} · ${pet.stage}`.toUpperCase();
    $('#pet-reply').textContent = pet.lastReply || 'Your AXO is ready for today.';
    renderCurrentPetArtwork();
    $('#pet-xp').textContent = number(pet.xp);
    $('#pet-level').textContent = `LEVEL ${pet.level}`;
    $('#epoch-xp').textContent = number(hatchery.ledger?.currentEpochXp || profile?.currentEpoch?.participation?.verifiedXp || 0);
    $('#epoch-id').textContent = hatchery.ledger?.currentEpochId || profile?.currentEpoch?.id || 'CURRENT EPOCH';
    const floor = levelThresholds[Math.max(0, Number(pet.level || 1) - 1)] || 0;
    const target = pet.nextLevel?.xp || levelThresholds[Math.min(9, Number(pet.level || 1))] || pet.xp;
    const progress = pet.level >= 10 ? 100 : Math.max(0, Math.min(100, (Number(pet.xp || 0) - floor) / Math.max(1, target - floor) * 100));
    $('#pet-xp-progress').style.width = `${progress}%`;
    $('#pet-xp-next').textContent = pet.level >= 10 ? 'Maximum evolution reached' : `${number(Math.max(0, target - Number(pet.xp || 0)))} XP to level ${Number(pet.level || 1) + 1}`;
    renderVitals();
    renderCare();
    syncMobilePetControllerState();
  }

  function renderVitals() {
    const vitals = hatchery?.pet?.vitals || {};
    const values = ['happiness', 'energy', 'curiosity', 'bond'].map((name) => {
      const value = Math.max(0, Math.min(100, Number(vitals[name] || 0)));
      const bar = $(`#vital-${name}`);
      if (bar) {
        bar.setAttribute('aria-valuenow', String(Math.round(value)));
        bar.querySelector('i').style.width = `${value}%`;
      }
      const label = $(`#vital-${name}-value`);
      if (label) label.textContent = `${Math.round(value)}%`;
      return value;
    });
    const lowest = Math.min(...values);
    $('#pet-mood').textContent = hatchery?.pet?.happy ? 'THRIVING' : lowest < 35 ? 'NEEDS CARE' : lowest < 60 ? 'STEADY' : 'FEELING GOOD';
  }

  function careCountdown(target) {
    const remaining = Date.parse(target || 0) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return 'READY';
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor(remaining % 3_600_000 / 60_000);
    const seconds = Math.floor(remaining % 60_000 / 1_000);
    return hours ? `${hours}H ${String(minutes).padStart(2, '0')}M` : `${minutes}M ${String(seconds).padStart(2, '0')}S`;
  }

  function careControlState(target, xpPassportReady, pending, currentMs = Date.now()) {
    const nextAvailableMs = Date.parse(target || '');
    const cooldownReady = !target || (Number.isFinite(nextAvailableMs) && nextAvailableMs <= currentMs);
    return {
      cooldownReady,
      ready: !pending && cooldownReady && xpPassportReady,
    };
  }

  function beginCareInteraction(label) {
    if (careInteractionPending) return null;
    const token = ++careInteractionSequence;
    careInteractionPending = { token, label: String(label || 'Care action') };
    updateCareTimers();
    return token;
  }

  function endCareInteraction(token) {
    if (careInteractionPending?.token !== token) return;
    careInteractionPending = null;
    if (hatchery?.hatched) renderCare();
    else updateCareTimers();
  }

  function nextCareReceiptAction(care = hatchery?.player?.care, xpPassportReady = passportComplete()) {
    const ritual = care?.dailyRitual || {};
    if (!xpPassportReady || ritual.complete === true) return null;
    const nextStep = (Array.isArray(ritual.steps) ? ritual.steps : []).find((step) => step.completed !== true);
    const action = String(nextStep?.action || '').toLowerCase();
    return ['play', 'rest', 'train'].includes(action) ? action : null;
  }

  function continueAfterCareReceipt() {
    const action = nextCareReceiptAction();
    const target = action ? document.querySelector(`#pet-passport-card [data-care="${action}"]:not(:disabled)`) : null;
    if (!target) return action;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => target.focus({ preventScroll: true }), reduceMotion ? 0 : 350);
    return action;
  }

  function continueAfterCompletedCareRitual() {
    if (hatchery?.player?.care?.dailyRitual?.complete !== true) return null;
    return showMissionHandoff('CARE LOOP COMPLETE');
  }

  function missionCountdown(target) {
    const remaining = Math.max(0, Date.parse(target || 0) - Date.now());
    if (!Number.isFinite(remaining)) return '—';
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor(remaining % 3_600_000 / 60_000);
    const seconds = Math.floor(remaining % 60_000 / 1_000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function updateCareTimers() {
    $$('[data-care], [data-cuddle]').forEach((button) => {
      const target = button.dataset.nextAvailableAt;
      const xpPassportReady = !button.matches('[data-care]') || passportComplete();
      const pending = Boolean(careInteractionPending);
      const { cooldownReady, ready } = careControlState(target, xpPassportReady, pending);
      button.disabled = !ready;
      button.dataset.cooldownLocked = cooldownReady ? '' : 'true';
      button.classList.toggle('ready', ready);
      button.setAttribute('aria-busy', String(pending));
      const timer = button.querySelector('[data-care-timer]');
      if (timer) timer.textContent = pending ? 'SAVING…' : !xpPassportReady ? 'REFRESH PASS' : careCountdown(target);
      button.title = pending
        ? `${careInteractionPending.label} is saving; waiting for the verified server receipt`
        : !xpPassportReady
        ? 'Refresh your official AXO Telegram membership to unlock verified XP care'
        : ready ? `${button.querySelector('b')?.textContent || 'Care'} is ready` : `Available again in ${careCountdown(target)}`;
    });
    const careReset = $('#care-return-reset');
    if (careReset) careReset.textContent = missionResetTarget ? `IN ${missionCountdown(missionResetTarget)}` : 'WAITING FOR SYNC';
    updateMissionReset();
  }

  function updateMissionReset() {
    const element = $('#mission-reset');
    const timers = $$('[data-quest-timer]');
    const milestoneReset = $('#crew-milestone-epoch');
    const milestoneEpoch = hatchery?.crewMilestones;
    if (milestoneReset && milestoneEpoch?.resetsAt) milestoneReset.textContent = `${milestoneEpoch.epochId || 'CURRENT EPOCH'} · ${missionCountdown(milestoneEpoch.resetsAt)} LEFT`;
    if (!missionResetTarget) {
      if (element) element.textContent = 'RESET IN —';
      timers.forEach((timer) => { timer.textContent = 'WAITING FOR SYNC'; });
      updateContractQuestCooldown();
      updateSocialCooldowns();
      return;
    }
    const remaining = Date.parse(missionResetTarget) - Date.now();
    if (Number.isFinite(remaining) && remaining <= 0) {
      if (element) element.textContent = 'RESETTING…';
      timers.forEach((timer) => { timer.textContent = 'RESETTING…'; });
      if (!missionRefreshQueued) {
        missionRefreshQueued = true;
        window.setTimeout(() => { missionRefreshQueued = false; refreshData({ quiet: true }); }, 1_000);
      }
      updateContractQuestCooldown();
      updateSocialCooldowns();
      return;
    }
    const clock = missionCountdown(missionResetTarget);
    if (element) element.textContent = `RESET IN ${clock}`;
    timers.forEach((timer) => {
      const state = timer.closest('.quest-card')?.dataset.questState;
      timer.textContent = state === 'done' ? `NEXT QUEST IN ${clock}` : state === 'setup' ? `DAILY WINDOW · ${clock}` : `AVAILABLE · ${clock} LEFT`;
      timer.setAttribute('datetime', missionResetTarget);
    });
    updateContractQuestCooldown();
    updateSocialCooldowns();
  }

  function updateSocialCooldowns() {
    const socialElement = $('#social-creator-reset');
    const feedings = hatchery?.socialFeedings || [];
    const engagement = hatchery?.dailyXEngagement || null;
    const quests = [...feedings, ...(engagement ? [engagement] : [])];
    const actionable = quests.filter((quest) => quest?.available === true && quest?.completedToday !== true).length;
    const cooldownTargets = quests
      .filter((quest) => quest?.completedToday === true && Date.parse(quest.nextAvailableAt || '') > Date.now())
      .map((quest) => quest.nextAvailableAt)
      .sort();
    $$('.social-creator-card[data-social-next-available-at]').forEach((card) => {
      const target = card.dataset.socialNextAvailableAt;
      const status = card.querySelector('[data-social-status]');
      if (!target || !status || !card.classList.contains('done')) return;
      if (Date.parse(target) <= Date.now()) {
        status.textContent = 'REFRESHING…';
        if (!missionRefreshQueued) {
          missionRefreshQueued = true;
          window.setTimeout(() => { missionRefreshQueued = false; refreshData({ quiet: true }); }, 1_000);
        }
        return;
      }
      status.textContent = `24H COOLDOWN · ${missionCountdown(target)}`;
    });
    if (!socialElement) return;
    if (actionable > 0) socialElement.textContent = `${actionable} QUEST${actionable === 1 ? '' : 'S'} READY NOW`;
    else if (cooldownTargets.length) socialElement.textContent = `NEXT QUEST IN ${missionCountdown(cooldownTargets[0])}`;
    else socialElement.textContent = hatchery?.hatched ? 'COMPLETE PASSPORT TO START' : 'WAITING FOR SYNC';
  }

  function renderCare() {
    const care = hatchery?.player?.care || {};
    missionResetTarget = care.dailyRitual?.nextResetAt || null;
    if (missionResetTarget && Date.parse(missionResetTarget) > Date.now()) missionRefreshQueued = false;
    const ritual = care.dailyRitual || {};
    const steps = Array.isArray(ritual.steps) ? ritual.steps : [];
    const completed = number(ritual.completed || 0);
    const goal = number(ritual.goal || 3);
    const nextStep = steps.find((step) => step.completed !== true);
    const passportReady = passportComplete();
    const panel = $('#care-return-panel');
    if (panel) {
      const state = !passportReady ? 'setup' : ritual.complete === true ? 'complete' : completed > 0 ? 'active' : 'ready';
      panel.dataset.state = state;
      $('#care-return-status').textContent = `${completed} / ${goal} TODAY`;
      $('#care-return-streak').textContent = `${number(care.streak || 0)} ${number(care.streak || 0) === 1 ? 'DAY' : 'DAYS'}`;
      if (!passportReady) {
        $('#care-return-title').textContent = 'Refresh your current XP pass';
        $('#care-return-copy').textContent = 'Your Pet and saved streak remain intact. Refresh official AXO Telegram membership before an XP-bearing care action.';
      } else if (ritual.complete === true) {
        $('#care-return-title').textContent = 'Return when daily care resets';
        $('#care-return-copy').textContent = `Today’s ${completed}/${goal} care receipts are saved. The verified return streak and Pet XP shown here come only from existing server receipts.`;
      } else {
        const action = String(nextStep?.label || nextStep?.action || 'care for AXO');
        $('#care-return-title').textContent = completed > 0 ? `${action} next` : 'Start today’s care ritual';
        $('#care-return-copy').textContent = `${completed}/${goal} saved today. Complete each remaining ready action once; unavailable actions stay locked until the displayed reset.`;
      }
    }
    $$('[data-care]').forEach((button) => {
      const action = care.actions?.[button.dataset.care] || {};
      button.dataset.nextAvailableAt = action.completedToday ? (action.nextAvailableAt || care.dailyRitual?.nextResetAt || '') : '';
    });
    $$('[data-cuddle]').forEach((button) => {
      button.dataset.nextAvailableAt = care.petting?.available === false ? (care.petting.nextHappinessAt || '') : '';
    });
    updateCareTimers();
    if (careTimer) window.clearInterval(careTimer);
    careTimer = window.setInterval(updateCareTimers, 1_000);
  }

  function markQuest(selector, completed, available = true) {
    const card = $(selector);
    card.classList.toggle('done', completed);
    card.classList.toggle('blocked', !completed && !available);
    card.dataset.questState = completed ? 'done' : available ? 'ready' : 'setup';
    card.querySelector('.quest-status').textContent = completed ? 'DONE' : available ? 'READY' : 'SETUP';
    const button = card.querySelector('button[type=button],button[type=submit]');
    if (button) button.disabled = completed || !available;
  }

  function updateContractQuestCooldown() {
    const card = $('#quest-feed-contract');
    if (!card || !hatchery?.hatched) return;
    const state = dailyContractRuntimeState();
    const prerequisitesReady = passportComplete() && canonicalAxoQuestAccessComplete();
    const available = state.available && prerequisitesReady;
    const visibleCooldown = state.coolingDown && state.accountActive && prerequisitesReady;
    markQuest('#quest-feed-contract', state.completed, available || visibleCooldown);
    card.classList.toggle('cooling', visibleCooldown);
    card.setAttribute('aria-busy', String(visibleCooldown));
    if (visibleCooldown) card.dataset.questState = 'cooldown';
    const status = card.querySelector('.quest-status');
    if (status && visibleCooldown) status.textContent = 'DIGESTING';
    const disabled = !prerequisitesReady || hatchery.player?.accountStatus?.suspended === true;
    card.querySelectorAll('input,button[type=submit]').forEach((element) => { element.disabled = disabled; });
    if (state.completed && prerequisitesReady) {
      card.classList.remove('done');
      card.dataset.questState = 'ready';
      if (status) status.textContent = 'RESEARCH OPEN';
    }
    const timer = card.querySelector('[data-quest-timer]');
    if (timer && visibleCooldown) {
      timer.textContent = `READY IN ${missionCountdown(state.nextAvailableAt)}`;
      timer.setAttribute('datetime', state.nextAvailableAt);
    }
  }

  function money(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return '—';
    return `$${new Intl.NumberFormat('en-US', { notation: amount >= 1_000 ? 'compact' : 'standard', maximumFractionDigits: amount >= 1 ? 2 : 6 }).format(amount)}`;
  }

  function change(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return `${amount > 0 ? '+' : ''}${amount.toFixed(Math.abs(amount) >= 10 ? 1 : 2)}%`;
  }

  function projectPool(address) {
    const target = String(address || '').toLowerCase();
    return marketPools.filter((pool) => {
      const subject = window.AxoChain?.analyticsSubjectAddress?.(pool);
      return String(subject || '').toLowerCase() === target;
    }).sort((left, right) => Number(right.liquidityUsd || 0) - Number(left.liquidityUsd || 0))[0] || null;
  }

  function projectPrice(pool, address) {
    if (!pool) return null;
    const target = String(address || '').toLowerCase();
    return String(pool.quoteToken?.address || '').toLowerCase() === target ? pool.quotePriceUsd : pool.priceUsd;
  }

  function projectMarket(project, pool) {
    const route = project.safety?.routeSnapshot || {};
    return {
      observed: Boolean(pool || route.poolAddress),
      priceUsd: projectPrice(pool, project.address) ?? route.priceUsd ?? null,
      priceChange24h: pool?.priceChange24h ?? route.priceChange24hPct ?? null,
      liquidityUsd: pool?.liquidityUsd ?? route.liquidityUsd ?? project.safety?.liquidityUsd ?? null,
      volume24hUsd: pool?.volume24hUsd ?? route.volume24hUsd ?? null,
      dex: pool?.dex || route.dex || null,
      observedAt: pool?.observedAt || route.observedAt || project.safety?.checkedAt || null,
    };
  }

  const projectActionIcon = (kind) => ({
    axo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 19 6v8l-7 8-7-8V6l7-4Z"/><path d="m9 13 2-5 4 3-3 5-3-3Z"/></svg>',
    dex: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V9m5 9V5m5 13v-7m5 7V3"/><path d="m3 8 5-3 5 5 6-7"/></svg>',
    matcha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h13l-3-3m3 3-3 3M20 17H7l3 3m-3-3 3-3"/><circle cx="6" cy="7" r="2"/><circle cx="18" cy="17" r="2"/></svg>',
  }[kind] || '');

  function projectActions(project, pool) {
    const address = String(project.address || '').toLowerCase();
    const poolAddress = pool?.poolAddress || project.safety?.routeSnapshot?.poolAddress || null;
    const routeReady = project.safety?.navigationReady === true || (
      pool?.tokenIntelligence?.security?.mechanicallyCleared === true
      && pool?.tokenIntelligence?.security?.fresh === true
    );
    const dex = window.AxoChain?.validPoolId?.(poolAddress)
      ? `<a class="project-action dex" href="https://dexscreener.com/robinhood/${escapeHtml(poolAddress)}" target="_blank" rel="noopener noreferrer external" aria-label="Open ${escapeHtml(project.symbol)} on Dexscreener">${projectActionIcon('dex')}<span>DEX</span></a>`
      : `<span class="project-action unavailable" title="No exact market pool is currently observed">${projectActionIcon('dex')}<span>DEX</span></span>`;
    const matcha = routeReady
      ? `<a class="project-action matcha" href="https://matcha.xyz/tokens/robinhood/${escapeHtml(address)}/select" target="_blank" rel="noopener noreferrer external" aria-label="Check the external Matcha route for ${escapeHtml(project.symbol)}">${projectActionIcon('matcha')}<span>MATCHA</span></a>`
      : `<span class="project-action matcha unavailable" title="Route check remains locked until fresh liquidity and sell-route checks pass">${projectActionIcon('matcha')}<span>LOCKED</span></span>`;
    return `<nav class="project-actions" aria-label="Open details for ${escapeHtml(project.symbol || 'contract')}"><a class="project-action axo" href="/token/${escapeHtml(address)}" aria-label="Open AXO analysis for ${escapeHtml(project.symbol)}">${projectActionIcon('axo')}<span>AXO</span></a>${dex}${matcha}</nav>`;
  }

  function renderQuests() {
    const nominationList = $('#cross-chain-nominations');
    if (nominationList) nominationList.innerHTML = (hatchery.crossChainNominations || []).slice(0, 5).map((item) =>
      `<p>${escapeHtml({ 8453: 'Base', 5042: 'Arc', 1: 'Ethereum', 56: 'BNB Chain' }[item.chainId] || 'Unknown chain')} · ${escapeHtml(short(item.address))} · UNVERIFIED · 0 XP</p>`).join('');
    const contractDone = hatchery.dailyContractQuest?.completedToday === true;
    const passportReady = passportComplete();
    const setupLink = $('#quest-feed-contract .quest-setup-link');
    if (setupLink) {
      const prerequisites = onboardingPrerequisites();
      setupLink.href = passportReady
        ? '#axo-corroboration-gate'
        : !prerequisites.x
          ? '#hatchery-connect-x'
          : !prerequisites.telegram
            ? '#hatchery-connect-telegram'
            : '#hatchery-verify-telegram-membership';
      setupLink.textContent = passportReady
        ? 'COMPLETE AXO ONBOARDING →'
        : !prerequisites.x
          ? 'CONNECT X PASSPORT →'
          : !prerequisites.telegram
            ? 'CONNECT TELEGRAM PASSPORT →'
            : 'VERIFY AXO TELEGRAM →';
    }
    $('#daily-progress-count').textContent = `${contractDone ? 1 : 0} / 1 DAILY`;
    $('#daily-progress-bar').style.width = `${contractDone ? 100 : 0}%`;
    updateMissionReset();
    renderJourney();
    if (hatchery.player?.accountStatus?.suspended) setMessage($('#quest-message'), 'This account is suspended. Existing XP and history remain preserved.', 'error');
  }

  function renderCrewMilestones() {
    const milestones = hatchery?.crewMilestones;
    const tiersElement = $('#crew-milestone-tiers');
    const claimButton = $('#crew-milestone-claim');
    if (!milestones || !tiersElement || !claimButton) return;
    const progress = number(milestones.progress || 0);
    const goal = Math.max(1, number(milestones.goal || 24));
    $('#crew-milestone-count').textContent = `${progress} / ${goal} QUESTS`;
    $('#crew-milestone-epoch').textContent = `${milestones.epochId || 'CURRENT EPOCH'} · ${missionCountdown(milestones.resetsAt)} LEFT`;
    $('#crew-milestone-progress-bar').style.width = `${Math.min(100, progress / goal * 100)}%`;
    tiersElement.innerHTML = (milestones.tiers || []).map((tier) => {
      const state = tier.claimed ? 'claimed' : tier.claimable ? 'claimable' : tier.unlocked ? 'unlocked' : 'locked';
      const status = tier.claimed ? 'CLAIMED' : tier.claimable ? 'READY TO CLAIM' : `${Math.min(progress, number(tier.threshold))} / ${number(tier.threshold)}`;
      return `<article class="crew-milestone-tier" data-state="${state}"><span>${escapeHtml(status)}</span><b>${escapeHtml(tier.label || `MILESTONE ${tier.threshold}`)}</b><strong>${number(tier.threshold)} QUESTS · +${number(tier.bonusXp)} PET + EPOCH XP</strong></article>`;
    }).join('');
    const claimableXp = number(milestones.claimableXp || 0);
    const allClaimed = milestones.completed === milestones.totalTiers && milestones.totalTiers > 0;
    claimButton.disabled = claimableXp <= 0 || hatchery.player?.accountStatus?.suspended === true;
    claimButton.textContent = claimableXp > 0
      ? `CLAIM +${claimableXp} PET + EPOCH XP`
      : allClaimed ? 'ALL MILESTONES CLAIMED' : 'KEEP QUESTING';
  }

  function renderSocialLinkCard(selector, feeding) {
    const card = $(selector);
    if (!card) return;
    const completed = feeding?.completedToday === true;
    const membershipRecheck = socialMembershipRecheckReady(feeding);
    const available = socialVerificationReady(feeding) && canonicalAxoQuestAccessComplete();
    card.dataset.socialNextAvailableAt = completed ? feeding?.nextAvailableAt || '' : '';
    card.classList.toggle('done', completed);
    card.classList.toggle('blocked', !completed && !available);
    card.querySelector('[data-social-status]').textContent = completed ? `24H COOLDOWN · ${missionCountdown(feeding?.nextAvailableAt)}` : membershipRecheck ? 'READY · MEMBERSHIP RECHECK' : available ? 'READY · +5 +5 XP' : 'SETUP';
    card.querySelectorAll('input,button[type=submit]').forEach((element) => { element.disabled = completed || !available; });
    const input = card.querySelector('input[name=postUrl]');
    if (input && completed && feeding.postUrl) input.value = feeding.postUrl;
    const publishLink = card.querySelector('.social-publish-link');
    if (publishLink && feeding?.composeUrl) publishLink.href = feeding.composeUrl;
  }

  function renderXEngagementCard(engagement) {
    const card = $('#social-creator-engagement');
    if (!card) return;
    const completed = engagement?.completedToday === true;
    const target = xEngagementTarget?.target || null;
    const membershipRecheck = socialMembershipRecheckReady(engagement);
    const available = socialVerificationReady(engagement) && canonicalAxoQuestAccessComplete() && Boolean(target?.postUrl);
    card.dataset.socialNextAvailableAt = completed ? engagement?.nextAvailableAt || '' : '';
    card.classList.toggle('done', completed);
    card.classList.toggle('blocked', !completed && !available);
    card.querySelector('[data-social-status]').textContent = completed ? `24H COOLDOWN · ${missionCountdown(engagement?.nextAvailableAt)}` : membershipRecheck ? 'READY · MEMBERSHIP RECHECK' : available ? 'READY · LIKE + REPLY' : 'WAITING';
    card.querySelectorAll('input,button[type=submit]').forEach((element) => { element.disabled = completed || !available; });
    const replyInput = card.querySelector('input[name=replyUrl]');
    if (completed && engagement.replyUrl) replyInput.value = engagement.replyUrl;
    const targetLink = $('#social-engagement-target');
    const targetUrl = completed ? engagement.targetUrl : target?.postUrl;
    targetLink.hidden = !targetUrl;
    if (targetUrl) targetLink.href = targetUrl;
    $('#social-engagement-target-copy').textContent = completed
      ? 'Like and direct reply verified against the AXO main account. Your daily receipt is stored.'
      : target
        ? `${target.textPreview || 'Latest original AXO main-account post'} Open it, like it, reply directly, then paste your reply link.`
        : 'The latest original AXO main-account post is temporarily unavailable. This quest stays fail-closed.';
  }

  function renderSocialQuests() {
    const feedings = Object.fromEntries((hatchery.socialFeedings || []).map((feeding) => [feeding.platform, feeding]));
    const quest = hatchery.dailyPromotionQuest || { completed: 0, goal: 0, maximumDailyXp: 0 };
    renderSocialLinkCard('#social-creator-x', feedings.x);
    renderSocialLinkCard('#social-creator-telegram', feedings.telegram);
    renderXEngagementCard(hatchery.dailyXEngagement);
    renderSocialNextAction();
    $('#social-creator-progress-count').textContent = `${number(quest.completed || 0)} / ${number(quest.goal || 0)} DAILY · +${number(quest.maximumDailyXp || 0)} PET + EPOCH XP MAX`;
    $('#social-creator-progress-bar').style.width = `${quest.goal ? Math.min(100, Number(quest.completed || 0) / Number(quest.goal) * 100) : 0}%`;
    updateSocialCooldowns();
    if (hatchery.player?.accountStatus?.suspended) setMessage($('#social-creator-message'), 'This account is suspended. Existing social XP remains preserved.', 'error');
  }

  function renderContracts() {
    const canonicalAxo = canonicalAxoAddress();
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const projects = (hatchery.projectQuests || []).filter((project) => {
      const nominatedAt = Date.parse(project.nominatedAt || 0);
      return String(project.address || '').toLowerCase() !== canonicalAxo && Number.isFinite(nominatedAt) && nominatedAt >= sevenDaysAgo;
    }).sort((a, b) => Number(b.feedCount || 0) - Number(a.feedCount || 0) || String(b.nominatedAt || '').localeCompare(String(a.nominatedAt || ''))).slice(0, 20);
    $('#contract-list').innerHTML = projects.length ? projects.map((project) => {
      const done = project.completedByPlayer === true;
      const queued = queuedProjectVotes.has(String(project.address || '').toLowerCase());
      const pool = projectPool(project.address);
      const market = projectMarket(project, pool);
      const score = pool?.opportunityScore ?? project.safety?.score;
      const marketState = market.observed ? `${escapeHtml(market.dex || 'EXACT ROUTE')} · MARKET OBSERVED` : escapeHtml(project.safety?.label || 'ANALYTICS PENDING');
      const pinned = Boolean(canonicalAxo && String(project.address || '').toLowerCase() === canonicalAxo);
      const judgment = project.userJudgment;
      const consensus = project.consensusVerdict === 'INTERESTING' ? 'HOT'
        : project.consensusVerdict === 'NOT_INTERESTING' ? 'COLD'
          : project.consensusVerdict === 'NEUTRAL' ? 'NEUTRAL'
            : project.consensusVerdict === 'SCAM' ? 'SCAM FLAG FORMING' : 'FORMING';
      const outcome = project.status === 'CORROBORATED' ? 'CORROBORATED' : project.status === 'CONTESTED' ? 'CONTESTED' : 'FORMING';
      const outcomeClass = outcome.toLowerCase();
      const expiresMs = Date.parse(project.expiresAt || 0);
      const epochId = project.epoch?.id || hatchery.ledger?.currentEpochId || 'CURRENT EPOCH';
      const timeLeft = Number.isFinite(expiresMs) ? duration(expiresMs - Date.now()).toUpperCase() : 'ACTIVE WINDOW';
      const doneLabel = judgment?.verdict === 'SCAM'
        ? 'SCAM FLAG'
        : Number.isInteger(judgment?.heatScore) ? `${heatLabels[judgment.heatScore]} · ${judgment.heatScore}/10`
          : judgment ? `${String(judgment.verdict || 'CALL').replaceAll('_', ' ')} · ${number(judgment.conviction)}%` : 'WEEKLY RECEIPT SAVED';
      const recordedAt = project.completion?.recordedAt ? new Date(project.completion.recordedAt).toLocaleString() : 'Receipt stored';
      const judgmentForm = done
        ? `<div class="contract-call recorded" role="status"><span>✓</span><div><small>WEEKLY VETTING SIGNED · ${escapeHtml(epochId)}</small><strong>DONE THIS WEEK · ${escapeHtml(doneLabel)}</strong><time>${escapeHtml(recordedAt)}</time></div></div>`
        : `<div class="contract-call contract-vote-form" data-corroborate-control="${escapeHtml(project.address)}"><div data-heat-meter></div><span class="heat-meter-status" data-heat-status aria-live="polite">${queued ? 'QUEUED · PROCESSING IN ORDER' : 'TAP A POSITION · INSTANT RECEIPT · +4 XP'}</span></div>`;
      const crewHeat = project.averageHeatScore !== null && project.averageHeatScore !== undefined && Number.isFinite(Number(project.averageHeatScore)) ? `${Number(project.averageHeatScore).toFixed(1)}/10 CREW HEAT` : 'NO HEAT YET';
      return `<article class="contract-row" data-market="${market.observed ? 'observed' : 'pending'}" data-pinned="${pinned}" data-weekly-vetting="${done ? 'done' : 'required'}"><div class="contract-id"><div class="contract-window-status"><span>${escapeHtml(epochId)}</span><span>${escapeHtml(timeLeft)} LEFT</span><span class="outcome ${outcomeClass}">${escapeHtml(outcome)}</span><span class="mine">${done ? 'DONE THIS WEEK ✓' : 'VET THIS WEEK'}</span></div><span>${escapeHtml(marketState)}</span><strong>${escapeHtml(project.symbol || project.name || 'CONTRACT')}</strong><code title="${escapeHtml(project.address)}">${escapeHtml(project.address)}</code></div><dl class="contract-analytics"><div><dt>PRICE</dt><dd>${money(market.priceUsd)}</dd></div><div><dt>24H</dt><dd class="${Number(market.priceChange24h || 0) >= 0 ? 'positive' : 'negative'}">${change(market.priceChange24h)}</dd></div><div><dt>LIQUIDITY</dt><dd>${money(market.liquidityUsd)}</dd></div><div><dt>24H VOLUME</dt><dd>${money(market.volume24hUsd)}</dd></div><div><dt>AXO SCORE</dt><dd>${Number.isFinite(Number(score)) ? `${number(score)}/100` : '—'}</dd></div></dl>${projectActions(project, pool)}<div class="feed-count"><strong>${number(project.qualifiedContributors || 0)} / 3</strong><small>THIS WEEK'S CREW</small><span>${escapeHtml(consensus)} · ${escapeHtml(crewHeat)} · SCAM ${number(project.scam?.votes || 0)}/${number(project.scam?.threshold || 3)}</span></div>${judgmentForm}</article>`;
    }).join('') : '<p class="empty-state">No contracts are active in the last seven days. Tag a verified Robinhood Chain contract above to open a fresh Crew window.</p>';
    $$('[data-corroborate-control]').filter((control) => control.id !== 'axo-onboarding-corroboration-form').forEach((control) => {
      const project = projects.find((entry) => entry.address === control.dataset.corroborateControl);
      renderHeatControl(control, {
        address: project?.address,
        disabled: !project?.accepting || project?.completedByPlayer === true || queuedProjectVotes.has(String(project?.address || '').toLowerCase()),
        includeScam: true,
        scamVotes: project?.scam?.votes || 0,
        scamThreshold: project?.scam?.threshold || 3,
        message: control.querySelector('[data-heat-status]'),
        label: project?.symbol || project?.name || 'contract',
      });
    });
  }

  function ledgerMarkup(rows = []) {
    if (!rows.length) return '<p class="empty-state">No XP activity recorded yet.</p>';
    return rows.slice(0, 30).map((row) => `<div class="ledger-row"><div><strong>${escapeHtml(row.label || row.reasonCode)}</strong><small>${row.epochId ? `${escapeHtml(row.epochId)} · ` : ''}${row.at ? new Date(row.at).toLocaleString() : 'Recorded'}</small></div><b class="${Number(row.delta) < 0 ? 'negative' : ''}">${Number(row.delta) > 0 ? '+' : ''}${number(row.delta)} XP</b></div>`).join('');
  }

  function renderLedgers() {
    $('#pet-ledger').innerHTML = ledgerMarkup(hatchery.ledger?.pet || []);
    $('#epoch-ledger').innerHTML = ledgerMarkup(hatchery.ledger?.epoch || []);
  }

  function formatUnits(raw, decimals, precision = 6) {
    if (!/^\d+$/.test(String(raw || '')) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
    const value = BigInt(raw);
    const scale = 10n ** BigInt(decimals);
    const whole = value / scale;
    const fraction = String(value % scale).padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
    return `${whole}${fraction ? `.${fraction}` : ''}`;
  }

  function duration(ms) {
    const value = Math.max(0, Number(ms || 0));
    const days = Math.floor(value / 86_400_000);
    const hours = Math.floor(value % 86_400_000 / 3_600_000);
    const minutes = Math.floor(value % 3_600_000 / 60_000);
    const seconds = Math.floor(value % 60_000 / 1_000);
    return days ? `${days}d ${hours}h ${minutes}m` : hours ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
  }

  function renderEpoch() {
    if (!$('#sidebar-epoch')) return;
    const epoch = board?.currentEpoch;
    if (!epoch) return;
    $('#sidebar-epoch').textContent = epoch.id;
    $('#sidebar-epoch-link').href = `https://www.axo.vision/epoch`;
    const rewardRaw = epoch.rewardPool?.rewardAmount;
    const rewardDecimals = Number(epoch.rewardPool?.rewardDecimals);
    const rewardSymbol = epoch.rewardPool?.rewardSymbol || 'TOKEN';
    const formattedReward = Number.isInteger(rewardDecimals) && rewardDecimals >= 0 && rewardDecimals <= 36 && /^\d+$/.test(String(rewardRaw || ''))
      ? `${formatUnits(rewardRaw, rewardDecimals, 6)} ${rewardSymbol}`
      : null;
    $('#epoch-prize').textContent = formattedReward || 'AWAITING VAULT';
    const currentVault = board?.rewardVault || board?.protocol?.implementation || {};
    $('#vault-status').textContent = rewardRaw
      ? String(epoch.rewardPool.status || 'FUNDING').replaceAll('_', ' ')
      : currentVault.status === 'CONFIGURED'
        ? currentVault.claimsEnabled ? 'CURRENT REWARD VAULT CONNECTED' : 'CURRENT REWARD VAULT CONNECTED · CLAIMS DISABLED'
        : 'NO VERIFIED EPOCH FUNDING';
    const vaultLink = $('#vault-contract-link');
    const vaultAddress = String(board?.rewardVault?.address || board?.protocol?.implementation?.contractAddresses?.[0] || '');
    if (/^0x[0-9a-f]{40}$/i.test(vaultAddress)) {
      vaultLink.href = `https://robinhoodchain.blockscout.com/address/${vaultAddress}`;
      vaultLink.textContent = `${vaultAddress.slice(0, 8)}…${vaultAddress.slice(-6)} ↗`;
      vaultLink.hidden = false;
    } else {
      vaultLink.hidden = true;
      vaultLink.removeAttribute('href');
    }
    const update = () => {
      const endsAt = epoch.status === 'OPEN' ? epoch.freezesAt : epoch.reviewEndsAt;
      $('#epoch-countdown').textContent = epoch.status === 'PREVIEW_CLOSED' ? 'CLOSED' : duration(Date.parse(endsAt) - Date.now());
    };
    update();
    if (countdownTimer) window.clearInterval(countdownTimer);
    countdownTimer = window.setInterval(update, 1_000);
    const holding = hatchery?.rewardHolding || profile?.rewardHolding || {};
    const rate = Number(holding.multiplierPct ?? 0);
    $('#holding-rate').textContent = holding.active && holding.multiplierPct !== null && holding.multiplierPct !== undefined
      ? `${rate.toFixed(rate % 1 ? 2 : 0)}%`
      : 'LIVE CLAIM CHECK';
    $('#holding-track').style.width = `${Math.max(0, Math.min(100, rate))}%`;
    const standings = epoch.standings || [];
    $('#top-five').innerHTML = standings.length ? standings.slice(0, 5).map((row, index) => {
      const rankPrize = epoch.rewardPool?.rankPrizes?.find((prize) => Number(prize.rank) === Number(row.rank || index + 1));
      const prizeRaw = row.weeklyPrizeAmountRaw || rankPrize?.amountRaw;
      const earning = /^\d+$/.test(String(prizeRaw || '')) && Number.isInteger(rewardDecimals)
        ? `${formatUnits(prizeRaw, rewardDecimals, 6)} ${rewardSymbol}`
        : null;
      return `<article class="leader-row"><span>${row.rank}</span><div><strong>${escapeHtml(row.name || row.genesisId)}</strong><small>${number(row.verifiedXp)} XP · ${Number(row.estimatedRewardSharePct || 0).toFixed(2)}% FIXED SHARE</small></div><b>${earning || 'PRIZE NOT SET'}</b></article>`;
    }).join('') : '<p class="empty-state">No eligible XP yet.</p>';
    const results = board.epochResults || [];
    $('#past-winners').innerHTML = results.length ? results.slice(0, 5).map((result) => `<article class="winner-epoch"><strong>${escapeHtml(result.id)}</strong><small>${escapeHtml(String(result.status).replaceAll('_', ' '))}</small><p>${(result.topFive || []).map((winner) => `#${winner.rank} ${escapeHtml(winner.name || winner.genesisId)}`).join(' · ') || 'No eligible winners'}</p><a href="https://www.axo.vision/epoch">OPEN EPOCH PAGE →</a></article>`).join('') : '<p class="empty-state">The first completed epoch will appear here.</p>';
  }

  function renderAll() {
    setConnectedState();
    if (!hatchery?.hatched) return;
    renderPet();
    renderPassport();
    renderCanonicalAxoCorroboration();
    renderFirstLoop();
    renderReferrals();
    renderQuests();
    renderCrewMilestones();
    renderSocialQuests();
    renderContracts();
    renderLedgers();
    renderEpoch();
    renderDailyCommand();
    renderCrewPulse();
    focusRequestedCareEntry();
    continueAfterSocialCallback();
  }

  function canonicalAxoPool(overview = {}) {
    const canonicalAxo = canonicalAxoAddress();
    const market = overview.market || {};
    const token = overview.token || {};
    const sourcePool = String(market.sourceUrl || '').split('/').filter(Boolean).at(-1);
    if (!canonicalAxo || !window.AxoChain?.validPoolId?.(sourcePool) || !Number.isFinite(Number(market.priceUsd))) return null;
    return {
      poolAddress: sourcePool,
      name: 'AXO exact pool',
      dex: market.source || 'BASED.BID EXACT POOL',
      baseToken: { address: canonicalAxo, symbol: token.symbol || 'AXO', name: token.name || 'AXO' },
      quoteToken: {},
      priceUsd: Number(market.priceUsd),
      quotePriceUsd: null,
      liquidityUsd: Number(market.liquidityUsd) || null,
      volume24hUsd: Number(market.volume24hUsd) || null,
      priceChange24h: Number.isFinite(Number(market.priceChange24hPct)) ? Number(market.priceChange24hPct) : null,
      observedAt: overview.checkedAt || new Date().toISOString(),
      exactCanonicalAxo: true,
    };
  }

  async function refreshProjectMarkets(projects = []) {
    const refreshId = ++marketRefreshId;
    const routePools = [...new Set(projects
      .map((project) => project.safety?.routeSnapshot?.poolAddress)
      .filter((poolAddress) => window.AxoChain?.validPoolId?.(poolAddress)))].slice(0, 8);
    const [universeResult, overviewResult, ...routeResults] = await Promise.allSettled([
      window.AxoChain?.fetchUniverse?.() || Promise.resolve([]),
      api('/api/rewards/overview'),
      ...routePools.map((poolAddress) => window.AxoChain.fetchPool(poolAddress)),
    ]);
    if (refreshId !== marketRefreshId) return;
    const combined = universeResult.status === 'fulfilled' && Array.isArray(universeResult.value) ? universeResult.value : [];
    for (const result of routeResults) if (result.status === 'fulfilled' && result.value) combined.push(result.value);
    if (overviewResult.status === 'fulfilled') {
      const axoPool = canonicalAxoPool(overviewResult.value);
      if (axoPool) combined.unshift(axoPool);
    }
    const byPool = new Map();
    for (const pool of combined) {
      const key = String(pool?.poolAddress || '').toLowerCase();
      if (key && !byPool.has(key)) byPool.set(key, pool);
    }
    marketPools = [...byPool.values()];
    if (hatchery?.hatched) renderContracts();
  }

  async function refreshData({ quiet = false } = {}) {
    if (dataRefreshInFlight) {
      dataRefreshQueued = true;
      return;
    }
    dataRefreshInFlight = true;
    let requestedWalletAddress = null;
    try {
      const nextSession = window.AxoWallet?.getSession?.() || session;
      const previousWalletAddress = verifiedWalletAddress(session);
      const nextWalletAddress = verifiedWalletAddress(nextSession);
      session = nextSession;
      if (previousWalletAddress !== nextWalletAddress) resetWalletData(nextWalletAddress ? 'loading' : 'idle');
      requestedWalletAddress = nextWalletAddress;
      setConnectedState();
      if (!requestedWalletAddress) return;
      const needsInitialLookup = !hatchery || loadedWalletAddress !== requestedWalletAddress;
      if (needsInitialLookup) {
        hatcheryLoadState = 'loading';
        setConnectedState();
      }
      const nextHatchery = await api('/api/hatchery');
      if (verifiedWalletAddress(session) !== requestedWalletAddress) {
        dataRefreshQueued = true;
        return;
      }
      hatchery = nextHatchery;
      loadedWalletAddress = requestedWalletAddress;
      hatcheryLoadState = 'ready';
      clearPetLoadRetry();
      renderAll();
      if (nextHatchery.hatched) {
        refreshProjectMarkets(nextHatchery.projectQuests || []).catch(() => {});
        const [nextBoard, nextProfile, nextReferrals, nextXEngagementTarget] = await Promise.all([
          $('#sidebar-epoch') ? api('/api/hatchery/dashboard?epochs=8') : Promise.resolve(null),
          api('/api/hatchery/alpha/me?epochs=8').catch(() => null),
          api('/api/hatchery/referrals').catch(() => null),
          nextHatchery.dailyXEngagement?.completedToday ? Promise.resolve(null) : api('/api/hatchery/social/x-engagement-target').catch(() => null),
        ]);
        if (verifiedWalletAddress(session) !== requestedWalletAddress) {
          dataRefreshQueued = true;
          return;
        }
        [board, profile, referrals, xEngagementTarget] = [nextBoard, nextProfile, nextReferrals, nextXEngagementTarget];
      }
      renderAll();
    } catch (error) {
      if (requestedWalletAddress && verifiedWalletAddress(session) !== requestedWalletAddress) {
        dataRefreshQueued = true;
        return;
      }
      if (error.status === 401) {
        session = { connected: false };
        resetWalletData('idle');
        setConnectedState();
      } else if (!hatchery || loadedWalletAddress !== requestedWalletAddress) {
        hatcheryLoadState = 'error';
        setConnectedState();
        schedulePetLoadRetry();
      } else if (!quiet) {
        setMessage($('#quest-message'), `Hatchery refresh unavailable: ${errorMessage(error)}`, 'error');
      }
    } finally {
      dataRefreshInFlight = false;
      if (dataRefreshQueued) {
        dataRefreshQueued = false;
        Promise.resolve().then(() => refreshData({ quiet: true }));
      }
    }
  }

  async function refreshEpochPrizeBoard() {
    if (document.hidden || epochBoardRefreshing) return;
    epochBoardRefreshing = true;
    try {
      board = await api('/api/hatchery/dashboard?epochs=8');
      if (hatchery?.hatched) renderEpoch();
    } catch { /* Preserve the last verified leaderboard until the next refresh. */ }
    finally { epochBoardRefreshing = false; }
  }

  async function mutate(path, payload, button, messageElement, workingMessage) {
    if (button) button.disabled = true;
    hideMissionHandoff();
    setMessage(messageElement, workingMessage);
    try {
      const result = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      hatchery = result;
      await refreshData({ quiet: true });
      return result;
    } catch (error) {
      setMessage(messageElement, errorMessage(error), 'error');
      throw error;
    } finally {
      if (button) button.disabled = false;
      if (hatchery?.hatched) renderCare();
    }
  }

  async function submitContract(rawAddress, button, message = $('#quest-message'), judgment = null) {
    const address = String(rawAddress || '').trim().toLowerCase();
    const canonicalAxo = canonicalAxoAddress();
    if (!/^0x[0-9a-f]{40}$/.test(address)) return setMessage(message, 'Paste a valid 0x contract address.', 'error');
    if (!passportComplete()) return setMessage(message, errorMessage({ code: 'hatchery_crew_passport_required' }), 'error');
    if (canonicalAxo && address !== canonicalAxo && !canonicalAxoQuestAccessComplete()) return setMessage(message, errorMessage({ code: 'canonical_axo_corroboration_required' }), 'error');
    const project = (hatchery.projectQuests || []).find((entry) => entry.address === address && entry.accepting);
    const task = project?.task || (hatchery.tasks || []).find((entry) => entry.type === 'contract_scout' && !entry.projectQuest);
    if (!task) return setMessage(message, 'Today’s contract feed is not available.', 'error');
    const requiresJudgment = Boolean(project) || Boolean(canonicalAxo && address === canonicalAxo);
    if (requiresJudgment && !['INTERESTING', 'NEUTRAL', 'NOT_INTERESTING', 'SCAM'].includes(judgment?.verdict)) return setMessage(message, errorMessage({ code: 'contract_judgment_required' }), 'error');
    if (canonicalAxo && address === canonicalAxo && judgment?.verdict === 'SCAM') return setMessage(message, errorMessage({ code: 'canonical_axo_scam_vote_forbidden' }), 'error');
    if (requiresJudgment && judgment?.verdict !== 'SCAM' && (!Number.isInteger(Number(judgment?.heatScore)) || Number(judgment.heatScore) < 0 || Number(judgment.heatScore) > 10)) return setMessage(message, errorMessage({ code: 'contract_conviction_required' }), 'error');
    const payload = { taskId: task.id, type: 'contract_scout', data: address };
    if (requiresJudgment) {
      payload.verdict = judgment.verdict;
      payload.confidence = Number(judgment.confidence);
      if (Number.isInteger(Number(judgment.heatScore))) payload.heatScore = Number(judgment.heatScore);
    }
    try {
      const result = await mutate('/api/hatchery/feed', payload, button, message, project ? judgment.verdict === 'SCAM' ? 'Recording your community scam flag…' : `Recording ${judgment.label || heatLabels[judgment.heatScore] || 'your heat call'}…` : 'Checking the contract and securing the first-scout slot…');
      const scam = result.result?.communityScam;
      const detail = project && judgment.verdict === 'SCAM'
        ? scam?.removedFromActiveList
          ? `Community scam quorum reached ${number(scam.votes)}/${number(scam.threshold)}. The contract is removed from the active list and stored as COMMUNITY SCAM in the Hatchery database.`
          : `Scam flag stored · ${number(scam?.votes || 0)}/${number(scam?.threshold || 3)} qualified Crew votes. Your weekly receipt is complete.`
        : project
          ? `${judgment.label || heatLabels[result.result?.heatScore] || 'HEAT CALL'} · ${number(result.result?.heatScore)} / 10 saved for ${result.result?.epochId || 'this week'}. +${number(result.result?.xpAwarded || 0)} Pet and Epoch XP now${result.result?.corroborationBonusAwarded ? '; corroboration bonuses just released.' : '; +6 more if your call matches the Crew result.'}`
          : `First-scout tag recorded. +${number(result.result?.xpAwarded || 0)} Pet and Epoch XP now. The token is open for weekly Crew vetting; your heat-meter judgment is available immediately.`;
      setMessage(message, detail, 'success');
      showMissionHandoff(canonicalAxo && address === canonicalAxo
        ? 'CREW PASSPORT CALL SAVED'
        : project
          ? 'CREW CALL SAVED'
          : 'SCOUT RECEIPT SAVED');
      $('#contract-feed-form').reset();
      return result;
    } catch { return null; /* mutate rendered the error */ }
  }

  async function submitSocialLink(platform, form) {
    const button = form.querySelector('button[type=submit]');
    const postUrl = String(form.elements.postUrl?.value || '').trim();
    if (!socialIdentityBundleReady()) return setMessage($('#social-creator-message'), errorMessage({ code: 'social_identity_bundle_required' }), 'error');
    if (!canonicalAxoQuestAccessComplete()) return setMessage($('#social-creator-message'), errorMessage({ code: 'canonical_axo_corroboration_required' }), 'error');
    try {
      const result = await mutate('/api/hatchery/social/daily-feed', { platform, postUrl, attested: true }, button, $('#social-creator-message'), `Verifying the linked ${platform === 'x' ? 'X' : 'Telegram'} post…`);
      const next = continueAfterSocialReceipt();
      setMessage($('#social-creator-message'), `Link verified. +${number(result.result?.petXpAwarded || result.result?.xpAwarded || 0)} Pet XP and +${number(result.result?.epochXpAwarded || 0)} Epoch XP.${next ? ` Next: ${next.title}.` : ''}`, 'success');
    } catch { /* mutate rendered the error */ }
  }

  async function submitXEngagement(form) {
    const button = form.querySelector('button[type=submit]');
    const replyUrl = String(form.elements.replyUrl?.value || '').trim();
    const targetUrl = xEngagementTarget?.target?.postUrl;
    if (!socialIdentityBundleReady()) return setMessage($('#social-creator-message'), errorMessage({ code: 'social_identity_bundle_required' }), 'error');
    if (!canonicalAxoQuestAccessComplete()) return setMessage($('#social-creator-message'), errorMessage({ code: 'canonical_axo_corroboration_required' }), 'error');
    if (!targetUrl) return setMessage($('#social-creator-message'), errorMessage({ code: 'x_engagement_target_unavailable' }), 'error');
    try {
      const result = await mutate('/api/hatchery/social/x-engagement', { targetUrl, replyUrl, attested: true }, button, $('#social-creator-message'), 'Checking the latest @axo_rh post, your like, and your direct reply…');
      const next = continueAfterSocialReceipt();
      setMessage($('#social-creator-message'), `Like + reply verified. +${number(result.result?.petXpAwarded || 0)} Pet XP and +${number(result.result?.epochXpAwarded || 0)} Epoch XP.${next ? ` Next: ${next.title}.` : ''}`, 'success');
    } catch { /* mutate rendered the error */ }
  }

  $('#hatch-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    if (!petLookupResolved() || hatchery?.hatched !== false) {
      setMessage($('#hatch-message'), 'AXO is still checking this verified wallet for its existing pet. Please wait for that lookup to finish.', 'error');
      return;
    }
    try {
      hatchery = await mutate('/api/hatchery/hatch', { name: event.currentTarget.elements.name.value }, button, $('#hatch-message'), 'Opening the crystal shell…');
      setMessage($('#hatch-message'), 'Your AXO is ready.', 'success');
      await refreshData({ quiet: true });
    } catch { /* mutate rendered the error */ }
  });

  $('#contract-feed-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const reference = String(form.elements.contractAddress.value || '').trim();
    const message = $('#quest-message');
    if (!passportComplete() || !canonicalAxoQuestAccessComplete()) return setMessage(message, 'Complete your Crew Passport and AXO corroboration first.', 'error');
    mutate('/api/hatchery/feed', { type: 'contract_scout', taskId: 'auto_chain_project', data: reference }, form.querySelector('button'), message,
      /^0x[0-9a-fA-F]{40}$/.test(reference) ? 'Checking contract code on all five chains…' : 'Resolving exact chain and contract…')
      .then((result) => {
        if (result.result?.nomination) {
          const chain = { 8453: 'Base', 5042: 'Arc', 1: 'Ethereum', 56: 'BNB Chain' }[result.result.nomination.chainId] || 'Other chain';
          setMessage(message, `${chain} research nomination saved. Contract not verified; 0 XP, no Crew vote or reward.`, 'success');
        } else setMessage(message, `Robinhood Chain verified scout receipt saved. +${number(result.result?.xpAwarded || 0)} XP according to the existing quest gates.`, 'success');
        form.reset();
      }).catch(() => { /* mutate rendered the error */ });
  });

  $('#crew-milestone-claim')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      const result = await mutate('/api/hatchery/milestones/claim', {}, button, $('#crew-milestone-message'), 'Claiming every unlocked Crew milestone…');
      setMessage($('#crew-milestone-message'), `Milestones claimed. +${number(result.result?.petXpAwarded || 0)} Pet XP and +${number(result.result?.epochXpAwarded || 0)} Epoch XP stacked.`, 'success');
      showMissionHandoff('CREW MILESTONE CLAIMED');
    } catch { /* mutate rendered the error */ }
  });

  $('#hatchery-verify-telegram-membership')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const message = $('#telegram-membership-message');
    if (!onboardingPrerequisites().telegram) {
      setMessage(message, 'Connect your Telegram account first.', 'error');
      return;
    }
    try {
      await mutate('/api/hatchery/social/telegram/membership', {}, button, message, 'Checking your connected Telegram identity against the official AXO room…');
      const continuation = continueAfterMembershipRefresh();
      setMessage(message, continuation === 'AXO_CALL'
        ? 'AXO Telegram membership verified. Choose your own AXO heat call below to finish your Crew Passport.'
        : continuation === 'DAILY_COMMAND'
          ? 'AXO Telegram membership verified. Your next receipt-backed action is ready in the Command Deck.'
          : 'AXO Telegram membership verified.', 'success');
    } catch { /* mutate rendered the fail-closed verification error */ }
  });

  $('#social-creator-x-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitSocialLink('x', event.currentTarget);
  });
  $('#social-creator-telegram-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitSocialLink('telegram', event.currentTarget);
  });
  $('#social-creator-engagement-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitXEngagement(event.currentTarget);
  });

  $('#first-loop-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const clue = hatchery?.player?.onboarding?.clue;
    if (!clue) return setMessage($('#first-loop-message'), errorMessage({ code: 'first_trail_live_clue_unavailable' }), 'error');
    const payload = { clueId: clue.id, judgment: form.elements.judgment.value, strength: form.elements.strength.value, concern: form.elements.concern.value };
    if (!payload.judgment || !payload.strength || !payload.concern) return setMessage($('#first-loop-message'), 'Choose your read, strongest evidence, and main concern.', 'error');
    try {
      const result = await mutate('/api/hatchery/first-trail', payload, form.querySelector('button'), $('#first-loop-message'), 'Saving your provisional First Trail label…');
      setMessage($('#first-loop-message'), `First Trail complete. Level ${number(result.result?.newLevel || result.pet?.level || 2)} reached; ${result.result?.item?.name || 'your lineage tool'} is equipped.`, 'success');
      showMissionHandoff('FIRST TRAIL COMPLETE');
    } catch { /* mutate rendered the error */ }
  });

  $('#referral-copy').addEventListener('click', async (event) => {
    const value = $('#referral-link').value;
    if (!/^https:\/\//.test(value)) return;
    try {
      await navigator.clipboard.writeText(value);
      event.currentTarget.textContent = 'COPIED ✓';
      window.setTimeout(() => { event.currentTarget.textContent = 'COPY'; }, 1_500);
    } catch {
      $('#referral-link').select();
      setMessage($('#referral-message'), 'Select and copy the referral link manually.', 'error');
    }
  });

  $('#pet-share-create').addEventListener('click', async (event) => {
    const maker = $('#pet-passport');
    maker.dataset.loading = 'true';
    event.currentTarget.disabled = true;
    setMessage($('#pet-share-message'), 'Freezing verified pet stats into a wallet-hidden share card…');
    try {
      const result = await api('/api/hatchery/pet-share', {
        method: 'POST',
        body: JSON.stringify({ variant: $('#pet-share-variant').value }),
      });
      petShareCard = result.card;
      renderPetShare();
      setMessage($('#pet-share-message'), `${petShareCard.achievement?.label || 'Pet Passport'} ready. The /pet/ link is immutable and carries your referral journey.`, 'success');
    } catch (error) {
      setMessage($('#pet-share-message'), errorMessage(error), 'error');
    } finally {
      maker.dataset.loading = 'false';
      event.currentTarget.disabled = false;
    }
  });

  $('#pet-share-copy').addEventListener('click', async (event) => {
    if (!petShareCard?.url) return;
    try {
      await navigator.clipboard.writeText(petShareCard.url);
      event.currentTarget.textContent = 'COPIED ✓';
      window.setTimeout(() => { event.currentTarget.textContent = 'COPY'; }, 1_500);
    } catch {
      $('#pet-share-link').select();
      setMessage($('#pet-share-message'), 'Select and copy the /pet/ link manually.', 'error');
    }
  });

  $('#pet-share-native').addEventListener('click', async () => {
    if (!petShareCard?.url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${petShareCard.pet?.name || 'AXO'} Pet Passport`, text: petShareCard.text, url: petShareCard.url });
      } else {
        await navigator.clipboard.writeText(`${petShareCard.text}\n${petShareCard.url}`);
        setMessage($('#pet-share-message'), 'Share copy and /pet/ link copied.', 'success');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage($('#pet-share-message'), 'Sharing was unavailable. Copy the /pet/ link instead.', 'error');
    }
  });

  $('#referral-activate').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    setMessage($('#referral-message'), 'Rechecking both Crew records and adding Pet and Epoch XP…');
    try {
      const result = await api('/api/hatchery/referrals/activate', { method: 'POST', body: '{}' });
      referrals = result.referral;
      setMessage($('#referral-message'), `Referral activated. +${number(result.settlement?.claimantEpochXpAwarded || 0)} Epoch XP for you and +${number(result.settlement?.referrerEpochXpAwarded || 0)} for your scout.`, 'success');
      await refreshData({ quiet: true });
    } catch (error) {
      setMessage($('#referral-message'), errorMessage(error), 'error');
      renderReferrals();
    }
  });

  $$('[data-care]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.dataset.care;
    const token = beginCareInteraction(`${action[0].toUpperCase()}${action.slice(1)}`);
    if (!token) return;
    let receiptSaved = false;
    try {
      await mutate('/api/hatchery/care', { action }, button, $('#care-message'), `${action} with your AXO…`);
      receiptSaved = true;
    } catch { /* mutate rendered the error */ }
    finally { endCareInteraction(token); }
    if (!receiptSaved) return;
    const continuation = continueAfterCareReceipt();
    const nextLoop = continuation ? null : continueAfterCompletedCareRitual();
    const nextLabel = continuation ? `${continuation[0].toUpperCase()}${continuation.slice(1)}` : null;
    setMessage($('#care-message'), nextLabel
      ? `${action[0].toUpperCase()}${action.slice(1)} receipt saved. ${nextLabel} is ready next.`
      : nextLoop
        ? `${action[0].toUpperCase()}${action.slice(1)} receipt saved. Today’s care ritual is complete. Next: ${nextLoop.title}.`
        : hatchery?.player?.care?.dailyRitual?.complete === true
          ? `${action[0].toUpperCase()}${action.slice(1)} receipt saved. Today’s care ritual is complete.`
          : `${action[0].toUpperCase()}${action.slice(1)} complete.`, 'success');
  }));

  $$('[data-cuddle]').forEach((button) => button.addEventListener('click', async (event) => {
    const token = beginCareInteraction('Cuddle');
    if (!token) return;
    try {
      await mutate('/api/hatchery/pet', { durationMs: 120, interaction: 'QUICK_CUDDLE' }, event.currentTarget, $('#care-message'), 'Cuddling your AXO…');
      setMessage($('#care-message'), 'Cuddle complete. Bond beats button mashing.', 'success');
    } catch { /* mutate rendered the error */ }
    finally { endCareInteraction(token); }
  }));

  setupMobilePetController();

  $('#hatchery-connect-x')?.addEventListener('click', (event) => startSocialConnection('x', event.currentTarget));
  $('#hatchery-connect-telegram')?.addEventListener('click', (event) => startSocialConnection('telegram', event.currentTarget));
  $('#mission-handoff-dismiss')?.addEventListener('click', hideMissionHandoff);
  $('#mission-handoff-link')?.addEventListener('click', hideMissionHandoff);

  $('#pet-loading-retry').addEventListener('click', () => {
    clearPetLoadRetry();
    hatcheryLoadState = 'loading';
    setConnectedState();
    refreshData();
  });

  window.addEventListener('axo:session', (event) => {
    const nextSession = event.detail || { connected: false };
    const previousWalletAddress = verifiedWalletAddress(session);
    const nextWalletAddress = verifiedWalletAddress(nextSession);
    session = nextSession;
    if (previousWalletAddress !== nextWalletAddress) resetWalletData(nextWalletAddress ? 'loading' : 'idle');
    setConnectedState();
    refreshData({ quiet: previousWalletAddress === nextWalletAddress });
  });
  window.addEventListener('pageshow', () => refreshData({ quiet: true }));

  (async () => {
    if (window.AxoWallet?.ready) await window.AxoWallet.ready.catch(() => {});
    session = window.AxoWallet?.getSession?.() || session;
    hatcheryLoadState = verifiedWalletAddress(session) ? 'loading' : 'idle';
    setConnectedState();
    const requestedContract = new URLSearchParams(window.location.search).get('contract');
    if (/^0x[0-9a-fA-F]{40}$/.test(String(requestedContract || ''))) $('#contract-feed-form').elements.contractAddress.value = requestedContract;
    await refreshData();
    if ($('#sidebar-epoch')) window.setInterval(refreshEpochPrizeBoard, 30_000);
  })();
})();
