import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { AuthedImage } from '../../TrainingKits/KitParts';
import { downloadFile, errorText } from '../../TrainingKits/kitApi';
import { humanSize } from '../../TrainingKits/kitModel';
import { STAGES, stageIndex, ROLE_LABEL, eventInfo, diffData, fmtDateTime } from './mediaModel';
import './Media.css';

const isImage = (f) => /^image\//.test(f?.mime || '') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f?.name || '');

/** Where the request stands on its line: منفذ الطلب → فريق التصميم → … → المدير. */
export const StageStrip = ({ status }) => {
  const at = stageIndex(status);
  return (
    <ol className="mr-stages" aria-label="مسار الطلب">
      {STAGES.map((s, i) => {
        const state = status === 'approved' || i < at ? 'done' : i === at ? 'now' : 'next';
        return (
          <li key={s.key} className={state} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="dot" aria-hidden="true">{state === 'done' ? '✓' : s.icon}</span>
            <span className="lbl">{s.label}</span>
          </li>
        );
      })}
      <li className={status === 'approved' ? 'done end' : 'next end'}>
        <span className="dot" aria-hidden="true">★</span><span className="lbl">معتمد</span>
      </li>
    </ol>
  );
};

/** One file of a design delivery: image preview or a file row; downloads. */
export const DesignFile = ({ api, f, url, big = false }) => {
  const get = () => downloadFile(api, url(f.fileId), f.name).catch(err => toast.error(errorText(err, 'تعذّر التنزيل')));
  if (isImage(f)) {
    return (
      <figure className={`mr-shot ${big ? 'big' : ''}`}>
        <div className="ph"><AuthedImage api={api} url={url(f.fileId)} alt={f.name} /></div>
        <figcaption><span className="name" title={f.name}>{f.name}</span><button type="button" className="tk-btn sm" onClick={get}>⬇ تنزيل</button></figcaption>
      </figure>
    );
  }
  return (
    <div className="tk-file">
      <span aria-hidden="true">📎</span>
      <span className="name" title={f.name}>{f.name}</span>
      <span className="size">{f.size ? humanSize(f.size) : ''}</span>
      <button type="button" className="tk-ibtn" title="تنزيل" aria-label={`تنزيل ${f.name}`} onClick={get}>⬇</button>
    </div>
  );
};

/** A delivered design version with its files (big previews). */
export const DesignView = ({ api, delivery, url, approved }) => {
  if (!delivery) return <div className="tk-blank"><span className="big">🎨</span><b>لم يُسلَّم تصميم بعد</b><span>يظهر هنا التصميم فور تسليمه من فريق التصميم.</span></div>;
  const files = delivery.files || [];
  const imgs = files.filter(isImage); const others = files.filter(f => !isImage(f));
  return (
    <div className="mr-design">
      <div className="mr-design-head">
        <span className={`tk-pill ${approved ? 'mint' : 'violet'}`}>{approved ? '✓ التصميم المعتمد' : 'التصميم الحالي'} · الإصدار {delivery.designVersion}</span>
        <span className="tk-muted-s">سلّمه {delivery.actorName || 'فريق التصميم'} · {fmtDateTime(delivery.createdAt)}</span>
      </div>
      {delivery.note && <div className="tk-ver-note"><b>ملاحظة المصمم</b>{delivery.note}</div>}
      {imgs.length > 0 && <div className="mr-shots">{imgs.map(f => <DesignFile key={f.fileId} api={api} f={f} url={url} big />)}</div>}
      {others.length > 0 && <div className="tk-files">{others.map(f => <DesignFile key={f.fileId} api={api} f={f} url={url} />)}</div>}
    </div>
  );
};

/** The whole line: every step, who and when, notes, design files, and what changed in each re-sent form. */
export const MediaTimeline = ({ api, events = [], url }) => {
  const [open, setOpen] = useState(() => new Set());
  if (!events.length) return <div className="tk-blank"><span className="big">🗂</span><b>لم يُرسل الطلب بعد</b><span>يُسجَّل هنا كل إجراء على الطلب: الإرسال، وكل إصدار من التصميم، وكل اعتماد أو إعادة مع الملاحظات.</span></div>;
  const toggle = (k) => setOpen(s => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const sent = events.filter(e => e.data);
  return (
    <ol className="mr-line">
      {[...events].reverse().map(e => {
        const info = eventInfo(e);
        const prevSent = e.data ? sent[sent.indexOf(e) - 1] : null;
        const showDiff = open.has(e.seq);
        const changes = showDiff && prevSent ? diffData(prevSent.data, e.data) : [];
        return (
          <li key={e.eventId || e.seq} className={`mr-ev ${info.tone}`}>
            <span className="ico" aria-hidden="true">{info.icon}</span>
            <div className="body">
              <div className="head">
                <span className={`tk-pill ${e.actorRole === 'designer' ? 'violet' : e.actorRole === 'employee' ? 'muted' : 'cyan'}`}>{ROLE_LABEL[e.actorRole] || e.actorRole}</span>
                <b>{e.actorName}</b>
                <span className="when">{fmtDateTime(e.createdAt)}</span>
                <span className="seq mono">#{e.seq}</span>
              </div>
              <div className="what">{info.label}</div>
              {e.note && <div className="tk-quote">{e.note}</div>}
              {(e.files || []).length > 0 && (
                <div className="mr-ev-files">{e.files.map(f => <DesignFile key={f.fileId} api={api} f={f} url={url} />)}</div>
              )}
              {prevSent && (
                <button type="button" className="tk-btn sm ghost" onClick={() => toggle(e.seq)} aria-expanded={showDiff}>
                  {showDiff ? 'إخفاء التعديلات' : 'ما الذي تغيّر في الطلب؟'}
                </button>
              )}
              {showDiff && (
                <div className="tk-diff">
                  {!changes.length && <p className="tk-diff-empty">لم تتغير بيانات النموذج.</p>}
                  {changes.map((c, i) => (
                    <div key={i} className="tk-diff-row">
                      <span className="lbl">{c.label} <span className={`tk-pill ${c.kind === 'added' ? 'mint' : c.kind === 'removed' ? 'red' : 'amber'}`}>{c.kind === 'added' ? 'أُضيف' : c.kind === 'removed' ? 'حُذف' : 'عُدّل'}</span></span>
                      {c.before && <del>{c.before}</del>}
                      {c.after && <ins>{c.after}</ins>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
