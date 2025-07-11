import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase";

function LoginButton() {
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Giriş başarılı:", user);
      alert(`Hoş geldin ${user.displayName}`);
    } catch (error) {
      console.error("Giriş hatası:", error);
    }
  };

  return <button onClick={handleLogin}>Google ile Giriş Yap</button>;
}

export default LoginButton;
