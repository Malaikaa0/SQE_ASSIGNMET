export default function Feedback({ type = 'success', message }) {
  if (!message) return null;
  return <div className={`feedback ${type}`}>{message}</div>;
}
