import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { redirectToUserSlug } from "../utils/auth";

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/create_user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Signup failed");

      localStorage.setItem("token", data.token);
      await redirectToUserSlug(navigate);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.back} onClick={() => navigate("/")}>← back</p>
        <h2 style={styles.title}>Create account</h2>
        <p style={styles.sub}>Start managing your store today.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Full name</label>
          <input style={styles.input} type="text" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />

          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account →"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <span style={styles.link} onClick={() => navigate("/login")}>Log in</span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif", color: "#f0ede8" },
  card: { width: "100%", maxWidth: "400px", padding: "2.5rem", border: "1px solid #1e1e1e", borderRadius: "8px", background: "#0f0f0f" },
  back: { fontSize: "0.8rem", color: "#555", cursor: "pointer", marginBottom: "2rem", fontFamily: "monospace", letterSpacing: "0.1em" },
  title: { fontSize: "1.8rem", fontWeight: "normal", margin: "0 0 0.5rem" },
  sub: { color: "#666", fontSize: "0.9rem", margin: "0 0 2rem" },
  form: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  label: { fontSize: "0.8rem", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" },
  input: { background: "#161616", border: "1px solid #2a2a2a", borderRadius: "4px", padding: "0.75rem 1rem", color: "#f0ede8", fontSize: "1rem", fontFamily: "inherit", marginBottom: "1rem", outline: "none" },
  error: { color: "#e05c5c", fontSize: "0.85rem", margin: "0 0 0.5rem" },
  btn: { marginTop: "0.5rem", background: "#f0ede8", color: "#0a0a0a", border: "none", borderRadius: "4px", padding: "0.85rem", fontSize: "1rem", fontFamily: "inherit", fontWeight: "600", cursor: "pointer" },
  footer: { marginTop: "1.5rem", fontSize: "0.85rem", color: "#555", textAlign: "center" },
  link: { color: "#f0ede8", cursor: "pointer", textDecoration: "underline" },
};