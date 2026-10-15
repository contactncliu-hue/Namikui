import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppData, getActiveMembers } from '../../context/AppDataContext';
import { parseCpToRaw, parseCpWithCommas, RANK_GROUP_ORDER } from '../Members/memberUtils';
import {
  DEFAULT_ALLIANCES,
  DEFAULT_INFO,
  fmtCountdown,
  fmtPower,
  mergeInfo,
  newAlliance,
  parsePower,
  useKeyRow,
  useNow,
} from '../../lib/homeData';
import type { Alliance, HomeInfo, LinkMap, MoveEntry, ShieldMap } from '../../lib/homeData';
import { enablePush } from '../../lib/push';
import { db } from '../../lib/supabase';
import styles from './Home.module.css';

type StrKey = Exclude<keyof HomeInfo, 'parts' | 'overrides'>;
type PartKey = keyof HomeInfo['parts'];
const PARTS: Array<[PartKey, string]> = [
  ['hero', 'Hero'],
  ['science', 'Science'],
  ['vehicle', 'Vehicle'],
  ['buildings', 'Buildings'],
  ['pet', 'Pet'],
];

function Countdown({ until }: { until: number }) {
  const now = useNow(1000);
  const left = until - now;
  return <>{left > 0 ? fmtCountdown(left) : 'expired'}</>;
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className={styles.statBlock}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statBig}>{value}</div>
      {sub ? <div className={styles.statSub}>{sub}</div> : null}
    </div>
  );
}

function Chips({ items }: { items: Array<[string, () => void]> }) {
  return (
    <div className={styles.chipRow}>
      {items.map(([label, fn]) => (
        <button key={label} type="button" className={styles.chip} onClick={fn}>
          ✎ {label}
        </button>
      ))}
    </div>
  );
}

function Kv({ label, children, onEdit }: { label: string; children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className={styles.kv}>
      <div className={styles.kvLabel}>{label}</div>
      <div className={styles.kvValue}>
        {children}
        {onEdit && (
          <button type="button" className={styles.editBtn} onClick={onEdit}>
            ✎
          </button>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { currentUser, accounts } = useAuth();
  const { eventDates, members, homePhotos, noticeAnnouncements, getAttendanceStatus, memberAttendedCount } =
    useAppData();

  const role = currentUser.role;
  const username = currentUser.username ?? '';
  const canEdit = role === 'admin' || role === 'management';
  const isStaff = canEdit || role === 'alliance';

  const { value: rawInfo, update: updateInfo } = useKeyRow<HomeInfo>('homeInfo', DEFAULT_INFO);
  const { value: rawAlliances, update: updateAlliances } = useKeyRow<Alliance[]>('homeAlliances', DEFAULT_ALLIANCES);
  const { value: shields, update: updateShields } = useKeyRow<ShieldMap>('homeShields', {});
  const { value: links, update: updateLinks } = useKeyRow<LinkMap>('homeLinks', {});
  const { value: moves, update: updateMoves } = useKeyRow<MoveEntry[]>('moves', []);
  const { value: extraPhotos, update: updatePhotos } = useKeyRow<any[]>('homePhotosAdded', []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const isAdmin = role === 'admin';

  const shrink = (file: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const sc = Math.min(1, 1000 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = img.width * sc;
          c.height = img.height * sc;
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = rej;
        img.src = r.result as string;
      };
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const uploadPhoto = async (file: File, i: number): Promise<string> => {
    const blob = await (await fetch(await shrink(file))).blob();
    const path = `${Date.now()}-${i}.jpg`;
    const { error } = await db.storage.from('home-photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return db.storage.from('home-photos').getPublicUrl(path).data.publicUrl;
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const added = await Promise.all(
      Array.from(files).map(async (f, i) => ({
        id: Date.now() + i,
        dataUrl: await uploadPhoto(f, i),
        uploader: username,
        visibility: 'public',
      }))
    );
    await updatePhotos((cur) => [...added, ...cur]);
    if (fileRef.current) fileRef.current.value = '';
  };
  const delPhoto = async (id: number) => {
    if (!window.confirm('Delete this photo?')) return;
    const hit = extraPhotos.find((x) => x.id === id);
    const path = hit?.dataUrl?.split('/home-photos/')[1];
    if (path) await db.storage.from('home-photos').remove([path]);
    await updatePhotos((cur) => cur.filter((x) => x.id !== id));
  };

  const info = useMemo(() => mergeInfo(rawInfo), [rawInfo]);
  const list = rawAlliances.length ? rawAlliances : DEFAULT_ALLIANCES;
  const main = list.find((a) => a.isMain) ?? list[0];
  const now = useNow(30000);

  const [vsOpen, setVsOpen] = useState(false);
  const [vsA, setVsA] = useState({ name: '', server: '' });
  const [vsB, setVsB] = useState({ name: '', server: '' });

  const active = useMemo(() => getActiveMembers(members), [members]);

  // ---------- auto values ----------
  const mainCombatAuto = useMemo(
    () => active.reduce((s, m) => s + parseCpWithCommas(m.cp).raw, 0),
    [active]
  );
  const mainCombat = info.overrides.main_combat ? parsePower(info.overrides.main_combat) : mainCombatAuto;
  const mainMembers = info.overrides.main_members ?? `${active.length}/100`;

  const stateCombatAuto =
    mainCombat + list.filter((a) => a.id !== main.id).reduce((s, a) => s + parsePower(a.combat), 0);
  const stateCombat = info.overrides.state_combat ?? fmtPower(stateCombatAuto);

  const hitter = useMemo(() => {
    let bestName = '';
    let bestVal = 0;
    for (const m of active) {
      const v = m.f1Raw ?? parseCpToRaw(m.f1Cp).raw;
      if (v > bestVal) {
        bestVal = v;
        bestName = m.name;
      }
    }
    return { name: bestName, val: fmtPower(bestVal).replace(/B$/, 'G') };
  }, [active]);

  const avgRate = useMemo(() => {
    const totalEvents = eventDates.length;
    if (!totalEvents || !active.length) return 0;
    const totalAttended = active.reduce((sum, m) => sum + memberAttendedCount(m), 0);
    return (totalAttended / active.length / totalEvents) * 100;
  }, [eventDates, active, memberAttendedCount]);

  const recentEvents = useMemo(() => eventDates.slice(-5).reverse(), [eventDates]);

  const memberList = useMemo(
    () =>
      [...active].sort((a, b) => {
        const ra = RANK_GROUP_ORDER[a.rank || 'R1'] ?? 99;
        const rb = RANK_GROUP_ORDER[b.rank || 'R1'] ?? 99;
        if (ra !== rb) return ra - rb;
        return (b.f1Raw ?? parseCpToRaw(b.f1Cp).raw) - (a.f1Raw ?? parseCpToRaw(a.f1Cp).raw);
      }),
    [active]
  );

  const visiblePhotos = useMemo(
    () => [...extraPhotos, ...homePhotos].filter((p) => (p.visibility === 'alliance' ? isStaff : true)),
    [extraPhotos, homePhotos, isStaff]
  );
  const visibleNotices = useMemo(
    () => noticeAnnouncements.filter((n) => (n.visibility === 'alliance' ? isStaff : true)).slice(0, 3),
    [noticeAnnouncements, isStaff]
  );

  // ---------- standing ----------
  const rows = list.map((a) => ({ a, gp: parsePower(a.gamePower) })).sort((x, y) => y.gp - x.gp);
  const maxGp = Math.max(1, ...rows.map((r) => r.gp));
  const mainGp = parsePower(main.gamePower);
  const mainPos = rows.findIndex((r) => r.a.id === main.id) + 1;
  const second = rows.find((r) => r.a.id !== main.id);
  const standingNote =
    mainGp && mainPos === 1 && second && second.gp
      ? `${main.tag} is first of ${rows.length} by game power, ${fmtPower(mainGp - second.gp)} clear of [${second.a.tag}].`
      : mainGp
      ? `${main.tag} is #${mainPos} of ${rows.length} by game power.`
      : 'Enter game power on each alliance card to rank them.';

  const troopsRaw = parsePower(info.troops);
  const total = info.troops ? fmtPower(mainCombat + troopsRaw) : '-';

  // ---------- shields & links ----------
  const norm = (s: string) => s.trim().toLowerCase();
  const linkedId = (u: string): number | null => {
    if (u in links) return links[u] || null;
    const m = members.find((x) => x.status !== 'removed' && norm(x.name) === norm(u));
    return m ? m.id : null;
  };
  const myId = linkedId(username);
  const myMember = myId !== null ? members.find((m) => m.id === myId && m.status !== 'removed') : undefined;
  const myShield = myMember ? shields[myMember.id] : undefined;
  const shieldedNow = active.filter((m) => (shields[m.id]?.until ?? 0) > now).length;

  const setShield = (memberId: number, hours: number) =>
    updateShields((cur) => {
      const n = { ...cur };
      if (!hours) delete n[memberId];
      else n[memberId] = { until: Date.now() + hours * 3600000, hours };
      return n;
    });

  const linkValue = (u: string) => (u in links ? (links[u] ? String(links[u]) : 'none') : 'auto');
  const setLink = (u: string, v: string) =>
    updateLinks((cur) => {
      const n = { ...cur };
      if (v === 'auto') delete n[u];
      else n[u] = v === 'none' ? 0 : Number(v);
      return n;
    });

  // ---------- admin edit helpers ----------
  const editInfo = async (key: StrKey, label: string) => {
    const v = window.prompt(label, info[key]);
    if (v === null) return;
    await updateInfo((c) => ({ ...mergeInfo(c), [key]: v.trim() }));
  };
  const editPart = async (k: PartKey, label: string) => {
    const v = window.prompt(`${label} combat power (e.g. 7.11B)`, info.parts[k]);
    if (v === null) return;
    await updateInfo((c) => {
      const m = mergeInfo(c);
      return { ...m, parts: { ...m.parts, [k]: v.trim() } };
    });
  };
  const editOverride = async (key: string, label: string) => {
    const v = window.prompt(`${label} - leave empty to go back to auto`, info.overrides[key] ?? '');
    if (v === null) return;
    await updateInfo((c) => {
      const m = mergeInfo(c);
      const o = { ...m.overrides };
      if (v.trim()) o[key] = v.trim();
      else delete o[key];
      return { ...m, overrides: o };
    });
  };
  const editAlliance = async (a: Alliance, field: keyof Alliance, label: string) => {
    const v = window.prompt(label, String(a[field] ?? ''));
    if (v === null) return;
    await updateAlliances((cur) =>
      (cur.length ? cur : DEFAULT_ALLIANCES).map((x) => (x.id === a.id ? { ...x, [field]: v.trim() } : x))
    );
  };
  const addAlliance = async () => {
    const name = window.prompt('Alliance name');
    if (!name || !name.trim()) return;
    const tag = window.prompt('Alliance tag (e.g. SDL)') ?? '';
    await updateAlliances((cur) => [
      ...(cur.length ? cur : DEFAULT_ALLIANCES),
      newAlliance(Date.now(), name.trim(), tag.trim()),
    ]);
  };
  const removeAlliance = async (a: Alliance) => {
    if (!window.confirm(`Remove ${a.name}? The state total will update.`)) return;
    await updateAlliances((cur) => (cur.length ? cur : DEFAULT_ALLIANCES).filter((x) => x.id !== a.id));
  };

  const recentMoves = moves.filter((m) => m.ts >= Date.now() - 30 * 86400000);
  const ago = (ts: number) => {
    const d = Math.floor((Date.now() - ts) / 86400000);
    if (d >= 1) return `${d}d ago`;
    const h = Math.floor((Date.now() - ts) / 3600000);
    return h >= 1 ? `${h}h ago` : 'just now';
  };
  const moveText = (m: MoveEntry) =>
    m.type === 'join'
      ? m.from ? `joined from ${m.from}` : 'joined'
      : m.type === 'leave'
      ? m.to ? `left for ${m.to}` : 'left'
      : 'renamed';
  const editMove = async (m: MoveEntry) => {
    const field = m.type === 'join' ? 'from' : 'to';
    const v = window.prompt(m.type === 'join' ? 'Joined from which alliance?' : 'Left for which alliance?', m[field] ?? '');
    if (v === null) return;
    await updateMoves((cur) => cur.map((x) => (x.id === m.id ? { ...x, [field]: v.trim() } : x)));
  };
  const delMove = async (m: MoveEntry) => {
    if (!window.confirm(`Delete this entry for ${m.name}?`)) return;
    await updateMoves((cur) => cur.filter((x) => x.id !== m.id));
  };
  const renderMoves = (type: MoveEntry['type']) => {
    const items = recentMoves.filter((m) => m.type === type);
    if (!items.length) return <div className={styles.emptyMini}>None</div>;
    return items.map((m) => (
      <div key={m.id} className={styles.moveRow}>
        <div>
          <div className={styles.moveName}>
            {m.name}
            {m.type === 'rename' && <span className={styles.moveSub}> was {m.oldName}</span>}
          </div>
          <div className={styles.moveSub}>
            {moveText(m)} · {ago(m.ts)}
            {m.cp ? ` · CP ${m.cp}` : ''}
          </div>
        </div>
        {canEdit && (
          <div className={styles.moveBtns}>
            {m.type !== 'rename' && (
              <button type="button" className={styles.editBtn} onClick={() => void editMove(m)}>
                ✎
              </button>
            )}
            <button type="button" className={styles.editBtn} onClick={() => void delMove(m)}>
              ✕
            </button>
          </div>
        )}
      </div>
    ));
  };

  // ---------- VS ----------
  const openVs = (a: Alliance) => {
    setVsA({ name: a.name, server: '277' });
    setVsB({ name: '', server: '' });
    setVsOpen(true);
  };

  // ---------- alliance card ----------
  const renderAlliance = (a: Alliance) => {
    const isMain = a.id === main.id;
    const gp = parsePower(a.gamePower);
    const combat = isMain ? fmtPower(mainCombat) : a.combat ? fmtPower(parsePower(a.combat)) : '-';
    const chips: Array<[string, () => void]> = [
      ['Name', () => void editAlliance(a, 'name', 'Alliance name')],
      ['Tag', () => void editAlliance(a, 'tag', 'Tag (e.g. z0.0)')],
      ['Leader', () => void editAlliance(a, 'leader', 'Leader')],
      ['Founded', () => void editAlliance(a, 'founded', 'Founded date')],
      ['Icon URL', () => void editAlliance(a, 'icon', 'Icon image URL')],
      ['Game power', () => void editAlliance(a, 'gamePower', 'Game power (e.g. 116B)')],
      ['Change', () => void editAlliance(a, 'change', 'Change (e.g. no change, +1.2B)')],
      ['State rank', () => void editAlliance(a, 'stateRank', 'State rank (e.g. 1st of 16)')],
      ['Trend', () => void editAlliance(a, 'trend', 'Trend')],
    ];
    if (isMain) {
      chips.push(
        ['Combat (override)', () => void editOverride('main_combat', 'Combat power (e.g. 23.0B)')],
        ['Members (override)', () => void editOverride('main_members', 'Members (e.g. 91/100)')]
      );
    } else {
      chips.push(
        ['Combat power', () => void editAlliance(a, 'combat', 'Combat power (e.g. 20B)')],
        ['Members', () => void editAlliance(a, 'members', 'Members (e.g. 82/100)')],
        ['Remove', () => void removeAlliance(a)]
      );
    }
    return (
      <div key={a.id} className={styles.card}>
        <div className={styles.allianceHead}>
          {a.icon ? <img className={styles.iconImg} src={a.icon} alt="" /> : null}
          <div className={styles.headText}>
            <div className={styles.allianceName}>
              [{a.tag || '-'}] {a.name}
            </div>
            <div className={styles.allianceSub}>
              State 277 · led by {a.leader || '-'} · founded {a.founded || '-'}
              {a.trend ? ` · ${a.trend}` : ''}
            </div>
          </div>
          <button type="button" className={styles.btnVs} onClick={() => openVs(a)}>
            VS
          </button>
        </div>
        {canEdit && <Chips items={chips} />}
        <div className={styles.statGrid}>
          <Stat label="COMBAT POWER" value={combat} sub={isMain ? 'auto from Members' : undefined} />
          <Stat label="GAME POWER" value={a.gamePower || '-'} sub={a.change || undefined} />
          <Stat
            label="STATE RANK"
            value={a.stateRank || '-'}
            sub={!isMain && gp && mainGp ? `${fmtPower(gp - mainGp)} vs ${main.tag}` : undefined}
          />
          <Stat label="MEMBERS" value={isMain ? mainMembers : a.members || '-'} />
        </div>
      </div>
    );
  };

  const standingChips: Array<[string, () => void]> = [
    ...PARTS.map(([k, l]): [string, () => void] => [l, () => void editPart(k, l)]),
    ['Troops', () => void editInfo('troops', 'Troops (e.g. 52.8B)')],
    ['Legion score', () => void editInfo('legionScore', 'Legion score (e.g. 4.64B)')],
    ['Legion rank', () => void editInfo('legionRank', 'Legion rank (e.g. #1 of 3)')],
  ];


  return (
    <section className={styles.view}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Home Dashboard</h1>
        <div className={styles.pageSubtext}>Welcome to Loopy's Playground Alliance Management Dashboard</div>
        <div>
          <button type="button" className={styles.btnShield} onClick={async () => alert({ ok: 'Notifications on', denied: 'Permission denied', unsupported: 'Not supported here', error: 'Could not save' }[await enablePush(username)])}>
            Enable notifications
          </button>
        </div>
        {isAdmin && (
          <div>
            <button type="button" className={styles.btnShield} onClick={() => setLinkOpen(true)}>
              Link accounts
            </button>
          </div>
        )}
      </div>

      {/* Recent photos */}
      <div className={`${styles.card} ${styles.accentGold}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>RECENT PHOTOS</div>
          {canEdit && (
            <>
              <button type="button" className={styles.btnShield} onClick={() => fileRef.current?.click()}>
                ＋ Add photos
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => void addPhotos(e.target.files)}
              />
            </>
          )}
        </div>
        {visiblePhotos.length === 0 ? (
          <div className={styles.emptyState}>No photos yet.</div>
        ) : (
          <div className={styles.photoRow}>
            {visiblePhotos.slice(0, 8).map((p, i) => (
              <div key={p.id} className={styles.photoThumb} onClick={() => setLbIdx(i)}>
                <img src={p.dataUrl} alt={p.uploader} />
                {canEdit && extraPhotos.some((x) => x.id === p.id) && (
                  <button type="button" className={styles.photoDel} onClick={(e) => { e.stopPropagation(); void delPhoto(p.id); }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notices */}
      <div className={`${styles.card} ${styles.accentRed}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>NOTICES</div>
        </div>
        {visibleNotices.length === 0 ? (
          <div className={styles.emptyState}>No notices yet.</div>
        ) : (
          <div>
            {visibleNotices.map((n) => (
              <div key={n.id} className={styles.noticeRow}>
                <div className={styles.noticeTop}>
                  <span className={styles.noticeName}>{n.title}</span>
                  <span className={styles.noticeDate}>{n.date}</span>
                </div>
                <div className={styles.noticeDesc}>{n.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event attendance */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>EVENT ATTENDANCE</div>
        </div>
        <div className={styles.statRow} style={{ marginBottom: 18 }}>
          <div className={`${styles.statValue} ${styles.statValueGold}`}>{avgRate.toFixed(1)}%</div>
        </div>
        <div className={styles.cardHeaderTitle} style={{ marginBottom: 12 }}>
          RECENT EVENTS
        </div>
        {recentEvents.length === 0 ? (
          <div className={styles.emptyState}>No events recorded yet.</div>
        ) : (
          <div className={styles.list}>
            {recentEvents.map((ev) => {
              const attendedCount = active.reduce((sum, m) => sum + (getAttendanceStatus(m.id, ev.id) ? 1 : 0), 0);
              const rate = active.length ? Math.round((attendedCount / active.length) * 100) : 0;
              return (
                <div key={ev.id} className={styles.listRow}>
                  <div className={styles.eventRowLeft}>
                    <span className={styles.eventRowName}>{ev.name || 'Event'}</span>
                    <span className={styles.eventRowDate}>{ev.date}</span>
                  </div>
                  <span className={styles.eventRowRate}>{rate}% attended</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My shield */}
      <div className={styles.shieldBar}>
        <div className={styles.shieldTitle}>MY SHIELD</div>
        {!myMember ? (
          <div className={styles.shieldStatus}>Your account is not linked to a member yet. Ask an admin to link it.</div>
        ) : (
          <>
            <div className={styles.shieldStatus}>
              {myMember.name}:{' '}
              {myShield && myShield.until > Date.now() ? (
                <strong>
                  <Countdown until={myShield.until} />
                </strong>
              ) : (
                'no active shield'
              )}
            </div>
            <div className={styles.moveBtns}>
              <button type="button" className={styles.btnShield} onClick={() => void setShield(myMember.id, 8)}>
                Start 8h
              </button>
              <button type="button" className={styles.btnShield} onClick={() => void setShield(myMember.id, 24)}>
                Start 24h
              </button>
              {myShield && myShield.until > Date.now() && (
                <button type="button" className={styles.btnShield} onClick={() => void setShield(myMember.id, 0)}>
                  Clear
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* State 277 */}
      <div className={styles.card}>
        <div className={styles.allianceHead}>
          {info.stateIcon ? <img className={styles.iconImg} src={info.stateIcon} alt="" /> : null}
          <div className={styles.headText}>
            <div className={styles.allianceName}>State 277</div>
            <div className={styles.allianceSub}>
              Peer rank {info.peerRank || '-'} · peer score {info.peerScore || '-'}
            </div>
          </div>
        </div>
        {canEdit && (
          <Chips
            items={[
              ['Peer rank', () => void editInfo('peerRank', 'Peer rank (e.g. #19 of 86)')],
              ['Peer score', () => void editInfo('peerScore', 'Peer score (e.g. 82/100)')],
              ['Icon URL', () => void editInfo('stateIcon', 'State 277 icon image URL')],
              ['Combat (override)', () => void editOverride('state_combat', 'State combat power')],
              ['Hitter (override)', () => void editOverride('hitter_val', 'Hardest hitter value')],
            ]}
          />
        )}
        <div className={styles.statGrid}>
          <Stat label="COMBAT POWER" value={stateCombat} sub="all alliances" />
          <Stat label="PEER SCORE" value={info.peerScore || '-'} sub={info.peerRank || undefined} />
          <Stat
            label="HARDEST HITTER"
            value={info.overrides.hitter_val ?? hitter.val}
            sub={hitter.name ? `${hitter.name} (highest F1 CP)` : undefined}
          />
        </div>
      </div>

      {/* Alliance cards: z0.0 first */}
      {[main, ...list.filter((a) => a.id !== main.id)].map(renderAlliance)}
      {canEdit && (
        <div>
          <button type="button" className={styles.btnShield} onClick={() => void addAlliance()}>
            ＋ Add alliance
          </button>
        </div>
      )}

      {/* Standing */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>STANDING</div>
        </div>
        <div className={styles.noteLine}>{standingNote}</div>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>ALLIANCE</th>
                <th></th>
                <th>GAME POWER</th>
                <th>CHANGE</th>
                <th>COMBAT</th>
                <th>GAP TO {main.tag.toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, gp }, i) => {
                const isMain = a.id === main.id;
                return (
                  <tr key={a.id} className={isMain ? styles.rowMain : undefined}>
                    <td>{i + 1}</td>
                    <td>
                      [{a.tag}] {a.name}
                    </td>
                    <td>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${(gp / maxGp) * 100}%` }} />
                      </div>
                    </td>
                    <td>{a.gamePower || '-'}</td>
                    <td>{a.change || '-'}</td>
                    <td>{isMain ? fmtPower(mainCombat) : a.combat ? fmtPower(parsePower(a.combat)) : '-'}</td>
                    <td>{isMain ? '' : gp && mainGp ? fmtPower(gp - mainGp) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.cardHeaderTitle} style={{ marginTop: 22 }}>
          COMBAT POWER BY PART
        </div>
        {canEdit && (
          <div style={{ marginTop: 10 }}>
            <Chips items={standingChips} />
          </div>
        )}
        <div className={styles.partsGrid}>
          {PARTS.map(([k, l]) => (
            <Stat
              key={k}
              label={l.toUpperCase()}
              value={info.parts[k] || '-'}
              sub={
                info.parts[k] && mainCombat
                  ? `${Math.round((parsePower(info.parts[k]) / mainCombat) * 100)}% of combat`
                  : undefined
              }
            />
          ))}
        </div>
        <div className={styles.footGrid}>
          <Stat label="TOTAL" value={total} sub="combat + troops" />
          <Stat label="TROOPS" value={info.troops || '-'} />
          <Stat label="LEGION SCORE" value={info.legionScore || '-'} sub={info.legionRank || undefined} />
        </div>
      </div>

      {/* On the map */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>ON THE MAP</div>
        </div>
        {canEdit && (
          <Chips
            items={[
              ['Hive centre', () => void editInfo('hiveCentre', 'Hive centre (e.g. X430 Y534)')],
              ['In the hive', () => void editInfo('inHive', 'In the hive (number)')],
              ['Spread out', () => void editInfo('spreadOut', 'Spread out (number)')],
              ['Headquarters', () => void editInfo('headquarters', 'Headquarters level range (e.g. Lv 70-80)')],
              ['Read time', () => void editInfo('mapRead', 'Map read time (e.g. Oct 13)')],
            ]}
          />
        )}
        <Kv label="Hive centre">{info.hiveCentre || '-'}</Kv>
        <Kv label="In the hive">
          {info.inHive || '-'}
          {info.spreadOut ? ` · ${info.spreadOut} spread out` : ''}
        </Kv>
        <Kv label="Shielded now">
          {shieldedNow} of {active.length} members
        </Kv>
        <Kv label="Headquarters">{info.headquarters || '-'}</Kv>
        <Kv label="Map read">{info.mapRead || '-'}</Kv>

        {canEdit && (
          <details className={styles.details}>
            <summary>Manage shields &amp; account links</summary>
            <div className={styles.cardHeaderTitle} style={{ margin: '14px 0 8px' }}>
              SHIELDS
            </div>
            {active.map((m) => {
              const s = shields[m.id];
              return (
                <div key={m.id} className={styles.shieldRow}>
                  <span className={styles.listRowName}>{m.name}</span>
                  <span className={styles.moveSub}>
                    {s && s.until > Date.now() ? <Countdown until={s.until} /> : '-'}
                  </span>
                  <span className={styles.moveBtns}>
                    <button type="button" className={styles.chip} onClick={() => void setShield(m.id, 8)}>
                      8h
                    </button>
                    <button type="button" className={styles.chip} onClick={() => void setShield(m.id, 24)}>
                      24h
                    </button>
                    <button type="button" className={styles.chip} onClick={() => void setShield(m.id, 0)}>
                      Clear
                    </button>
                  </span>
                </div>
              );
            })}
            <div className={styles.cardHeaderTitle} style={{ margin: '18px 0 8px' }}>
              ACCOUNT LINKS
            </div>
            {accounts.map((acc) => (
              <div key={acc.user_id} className={styles.linkRow}>
                <span className={styles.listRowName}>
                  {acc.username} <span className={styles.moveSub}>({acc.role})</span>
                </span>
                <select
                  className={styles.select}
                  style={{ marginBottom: 0 }}
                  value={linkValue(acc.username)}
                  onChange={(e) => void setLink(acc.username, e.target.value)}
                >
                  <option value="auto">Auto (match name)</option>
                  <option value="none">No member</option>
                  {memberList.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </details>
        )}
      </div>

      {/* Taking members */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>TAKING MEMBERS</div>
        </div>
        <Kv label="Joining" onEdit={canEdit ? () => void editInfo('joining', 'Joining rule') : undefined}>
          {info.joining || '-'}
        </Kv>
        <Kv label="Join power" onEdit={canEdit ? () => void editInfo('joinPower', 'Join power (e.g. 1.00B)') : undefined}>
          {info.joinPower || '-'}
        </Kv>
        <Kv label="Description" onEdit={canEdit ? () => void editInfo('description', 'Description') : undefined}>
          {info.description || '-'}
        </Kv>
      </div>

      {/* Who moved */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>WHO MOVED · 30D</div>
          <div className={styles.moveSub}>
            {recentMoves.filter((m) => m.type === 'join').length} in ·{' '}
            {recentMoves.filter((m) => m.type === 'leave').length} out
          </div>
        </div>
        <div className={styles.movedGrid}>
          <div>
            <div className={styles.statLabel}>JOINED</div>
            {renderMoves('join')}
          </div>
          <div>
            <div className={styles.statLabel}>LEFT</div>
            {renderMoves('leave')}
          </div>
          <div>
            <div className={styles.statLabel}>NAME CHANGES</div>
            {renderMoves('rename')}
          </div>
        </div>
      </div>

      {/* Photo viewer */}
      {lbIdx !== null && visiblePhotos[lbIdx] && (
        <div
          className={styles.lightbox}
          tabIndex={0}
          autoFocus
          onClick={() => setLbIdx(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLbIdx(null);
            if (e.key === 'ArrowRight') setLbIdx((lbIdx + 1) % visiblePhotos.length);
            if (e.key === 'ArrowLeft') setLbIdx((lbIdx - 1 + visiblePhotos.length) % visiblePhotos.length);
          }}
        >
          <button type="button" className={styles.lbClose} onClick={() => setLbIdx(null)}>Close</button>
          {visiblePhotos.length > 1 && (
            <button type="button" className={`${styles.lbNav} ${styles.lbPrev}`}
              onClick={(e) => { e.stopPropagation(); setLbIdx((lbIdx - 1 + visiblePhotos.length) % visiblePhotos.length); }}>
              &#8249;
            </button>
          )}
          <img className={styles.lbImg} src={visiblePhotos[lbIdx].dataUrl} alt="" onClick={(e) => e.stopPropagation()} />
          {visiblePhotos.length > 1 && (
            <button type="button" className={`${styles.lbNav} ${styles.lbNext}`}
              onClick={(e) => { e.stopPropagation(); setLbIdx((lbIdx + 1) % visiblePhotos.length); }}>
              &#8250;
            </button>
          )}
          <div className={styles.lbCount}>
            {lbIdx + 1} / {visiblePhotos.length}
            {visiblePhotos[lbIdx].uploader ? ` · ${visiblePhotos[lbIdx].uploader}` : ''}
          </div>
        </div>
      )}

      {/* Link accounts */}
      {linkOpen && (
        <div className={styles.modalBack} onClick={() => setLinkOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>LINK ACCOUNTS</div>
              <button type="button" className={styles.chip} onClick={() => setLinkOpen(false)}>
                ✕ Close
              </button>
            </div>
            {accounts.map((acc) => (
              <div key={acc.user_id} className={styles.linkRow}>
                <span className={styles.listRowName}>
                  {acc.username} <span className={styles.moveSub}>({acc.role})</span>
                </span>
                <select
                  className={styles.select}
                  style={{ marginBottom: 0 }}
                  value={linkValue(acc.username)}
                  onChange={(e) => void setLink(acc.username, e.target.value)}
                >
                  <option value="auto">Auto (match name)</option>
                  <option value="none">No member</option>
                  {memberList.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {vsOpen && (
        <div className={styles.modalBack} onClick={() => setVsOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>VS</div>
              <button type="button" className={styles.chip} onClick={() => setVsOpen(false)}>
                Close
              </button>
            </div>
            <div className={styles.statLabel}>Alliance 1</div>
            <input className={styles.select} placeholder="Alliance name" value={vsA.name}
              onChange={(e) => setVsA({ ...vsA, name: e.target.value })} />
            <input className={styles.select} placeholder="Server (e.g. 277)" value={vsA.server}
              onChange={(e) => setVsA({ ...vsA, server: e.target.value })} />
            <div className={styles.statLabel}>Alliance 2</div>
            <input className={styles.select} placeholder="Alliance name" value={vsB.name}
              onChange={(e) => setVsB({ ...vsB, name: e.target.value })} />
            <input className={styles.select} placeholder="Server (e.g. 301)" value={vsB.server}
              onChange={(e) => setVsB({ ...vsB, server: e.target.value })} />
            <div className={styles.vsResult}>
              <div className={styles.vsSide}>
                <div className={styles.vsName}>{vsA.name || '-'}</div>
                <div className={styles.moveSub}>Server {vsA.server || '-'}</div>
              </div>
              <div className={styles.vsMid}>VS</div>
              <div className={styles.vsSide}>
                <div className={styles.vsName}>{vsB.name || '-'}</div>
                <div className={styles.moveSub}>Server {vsB.server || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
