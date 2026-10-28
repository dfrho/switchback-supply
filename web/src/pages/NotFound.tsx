import { Link } from 'react-router';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Off trail');
  return (
    <main className="section section--page not-found">
      <p className="eyebrow">404</p>
      <h1>You wandered off trail.</h1>
      <p className="muted">That page does not exist. The trailhead is a click away.</p>
      <Link className="btn btn--primary" to="/shop">
        Back to the gear
      </Link>
    </main>
  );
}
