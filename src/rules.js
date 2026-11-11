// Eight ball rules (bar and league hybrid, close to what mobile pool games use).
import { groupOf } from './config.js';

export class EightBall {
  constructor(names) {
    this.names = names;
    this.cur = 0;
    this.groups = [null, null];
    this.phase = 'break';
    this.winner = null;
    this.msg = `${names[0]} to break`;
    this.shot = null;
  }

  legalTargets(balls, p = this.cur) {
    const alive = balls.filter(b => b.n > 0 && !b.potted);
    const g = this.groups[p];
    if (!g) return alive.filter(b => b.n !== 8);
    const own = alive.filter(b => groupOf(b.n) === g);
    return own.length ? own : alive.filter(b => b.n === 8);
  }

  remaining(balls, p) {
    const g = this.groups[p];
    if (!g) return null;
    return balls.filter(b => b.n > 0 && !b.potted && groupOf(b.n) === g).length;
  }

  beginShot(balls) {
    this.shot = { first: null, potted: [], railAfter: false, legal: this.legalTargets(balls).map(b => b.n) };
  }
  onHit(a, b) {
    const s = this.shot; if (!s) return;
    if (s.first == null && (a.n === 0 || b.n === 0)) s.first = a.n === 0 ? b.n : a.n;
  }
  onCushion() { const s = this.shot; if (s && s.first != null) s.railAfter = true; }
  onPocket(b) { if (this.shot) this.shot.potted.push(b.n); }

  // Returns { foul, over, respot8, ballInHand, switched }.
  endShot() {
    const s = this.shot, p = this.cur, o = 1 - p;
    this.shot = null;
    const isBreak = this.phase === 'break';
    const scratch = s.potted.includes(0);
    const eight = s.potted.includes(8);
    const others = s.potted.filter(n => n !== 0 && n !== 8);
    let foul = null;
    if (scratch) foul = 'Scratch';
    else if (s.first == null) foul = 'No ball hit';
    else if (!isBreak && !s.legal.includes(s.first)) foul = 'Wrong ball hit first';
    else if (!isBreak && s.potted.length === 0 && !s.railAfter) foul = 'No rail after contact';

    const res = { foul, over: false, respot8: false, ballInHand: false, switched: false };
    if (eight) {
      if (isBreak) res.respot8 = true;
      else {
        const legit = s.legal.length === 1 && s.legal[0] === 8 && !foul;
        this.winner = legit ? p : o;
        this.msg = legit ? `${this.names[p]} sinks the 8 and wins` :
          `${this.names[p]} ${foul ? 'fouled on the 8' : 'sank the 8 early'}. ${this.names[o]} wins`;
        res.over = true;
        return res;
      }
    }
    let assigned = false;
    if (!foul && !isBreak && !this.groups[p] && others.length) {
      const g = groupOf(others[0]);
      this.groups[p] = g; this.groups[o] = g === 'solids' ? 'stripes' : 'solids';
      assigned = true;
    }
    let keep = false;
    if (!foul) {
      if (isBreak) keep = others.length > 0;
      else if (this.groups[p]) keep = others.some(n => groupOf(n) === this.groups[p]);
    }
    this.phase = 'play';
    if (foul) {
      this.cur = o; res.switched = true; res.ballInHand = true;
      this.msg = `Foul: ${foul.toLowerCase()}. ${this.names[o]} has ball in hand`;
    } else if (!keep) {
      this.cur = o; res.switched = true;
      this.msg = `${this.names[o]} to shoot`;
    } else {
      this.msg = assigned ? `${this.names[p]} is ${this.groups[p]}. Shoot again` : `Nice shot. ${this.names[p]} shoots again`;
    }
    return res;
  }
}
