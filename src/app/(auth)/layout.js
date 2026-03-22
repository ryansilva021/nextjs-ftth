export default function AuthLayout({ children }) {
  return (
    <div
      style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}
      className="flex items-center justify-center"
    >
      {children}
    </div>
  )
}
