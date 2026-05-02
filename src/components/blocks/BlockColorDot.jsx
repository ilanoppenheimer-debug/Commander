export const BlockColorDot = ({ color, size = 8, className = '' }) => (
  <span
    className={`inline-block rounded-full flex-shrink-0 ${className}`}
    style={{ width: size, height: size, backgroundColor: color || '#475569' }}
  />
);
