import React, { useState } from 'react';
import { X, Cloud, Mail, Lock, User, AlertCircle, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    login, loginWithEmailAccount, registerWithEmailAccount, 
    authError, clearAuthError, isSyncing 
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    clearAuthError();
    await login();
    // Se o usuário foi logado, fecha modal
    // (O listener do Firebase fecha ou atualiza)
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    clearAuthError();

    let success = false;
    if (mode === 'login') {
      success = await loginWithEmailAccount(email.trim(), password);
    } else {
      success = await registerWithEmailAccount(email.trim(), password, name.trim());
    }

    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#FAF9F5] rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-200/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950 text-amber-300 flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-stone-900 leading-tight">
                {mode === 'login' ? 'Conectar à sua Estante' : 'Criar Conta no Lumina Books'}
              </h3>
              <p className="text-xs text-stone-500">
                Sincronize seus livros, anotações e áudios entre PC e Celular
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              clearAuthError();
              onClose();
            }}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Alerta de erro amigável */}
          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Aviso de Acesso:</span>
                <p className="leading-relaxed">{authError}</p>
              </div>
            </div>
          )}

          {/* Opção 1: Entrar com o Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSyncing}
            className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl text-stone-800 text-xs font-semibold flex items-center justify-center gap-2.5 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isSyncing ? 'Conectando ao Google...' : 'Entrar com a Conta Google'}</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-stone-200 w-full" />
            <span className="bg-[#FAF9F5] px-3 text-[10px] font-bold uppercase tracking-wider text-stone-600">
              Ou por e-mail e senha
            </span>
          </div>

          {/* Opção 2: Formulário de E-mail e Senha */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">Seu Nome</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como quer ser chamado"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Pelo menos 6 caracteres"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isSyncing}
              className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99] cursor-pointer"
            >
              <span>{isSubmitting ? 'Verificando...' : (mode === 'login' ? 'Entrar com E-mail' : 'Cadastrar Conta Grátis')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Alternar modo Login / Cadastro */}
          <div className="pt-2 text-center text-xs text-stone-600">
            {mode === 'login' ? (
              <p>
                Ainda não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setMode('register');
                  }}
                  className="font-semibold text-amber-900 hover:text-amber-950 underline underline-offset-2 cursor-pointer"
                >
                  Cadastre-se gratuitamente
                </button>
              </p>
            ) : (
              <p>
                Já possui uma conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setMode('login');
                  }}
                  className="font-semibold text-amber-900 hover:text-amber-950 underline underline-offset-2 cursor-pointer"
                >
                  Fazer login
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-stone-100/80 border-t border-stone-200/80 flex items-center justify-between text-[11px] text-stone-500">
          <span>Seus livros e áudios são protegidos</span>
          <button
            onClick={onClose}
            className="hover:text-stone-800 underline underline-offset-2"
          >
            Continuar Offline
          </button>
        </div>
      </div>
    </div>
  );
};
