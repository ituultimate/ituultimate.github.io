// LoginButton.jsx - Geliştirilmiş versiyon
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase";

function LoginButton() {
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Kullanıcı bilgilerini işleme
      console.log({
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photo: user.photoURL
      });
      
      // Yönlendirme veya state güncelleme
      window.location.href = "/dashboard"; // Örnek yönlendirme
      
    } catch (error) {
      console.error("Giriş hatası:", error.code, error.message);
      alert("Giriş başarısız: " + error.message);
    }
  };

  return (
    <button 
      onClick={handleLogin}
      style={{
        padding: "10px 15px",
        background: "#4285F4",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer"
      }}
    >
      Google ile Giriş Yap
    </button>
  );
}
