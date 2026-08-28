export default function Card({ children, className = '', elevated = false }) {
  return (
    <div className={`${elevated ? 'surface-elevated' : 'surface'} p-5 ${className}`}>
      {children}
    </div>
  );
}
