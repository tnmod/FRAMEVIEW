import React, { useState, useEffect } from 'react';
import {
  Server,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldCheck,
  Info,
  Trash2,
} from 'lucide-react';
import { useAiStore } from '../../store/aiStore';

export const ProviderSettings: React.FC = () => {
  const providers = useAiStore((s) => s.providers);
  const refreshOllama = useAiStore((s) => s.refreshOllama);
  const addCustomProvider = useAiStore((s) => s.addCustomProvider);
  const removeProvider = useAiStore((s) => s.removeProvider);
  const selectedVisionModelId = useAiStore((s) => s.selectedVisionModelId);
  const setSelectedVisionModelId = useAiStore((s) => s.setSelectedVisionModelId);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Auto-refresh Ollama when settings open
  useEffect(() => {
    refreshOllama('ollama_default').catch(() => {});
  }, [refreshOllama]);

  // Form state for custom endpoint
  const [newEndpointName, setNewEndpointName] = useState('');
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [newEndpointKey, setNewEndpointKey] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const ollamaProvider = providers.find((p) => p.type === 'ollama');

  const handleRefreshOllama = async () => {
    setIsRefreshing(true);
    await refreshOllama('ollama_default');
    setIsRefreshing(false);
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEndpointName.trim() || !newEndpointUrl.trim()) return;

    setIsAdding(true);
    await addCustomProvider({
      id: `custom_${Date.now()}`,
      name: newEndpointName.trim(),
      type: 'openai_compatible',
      endpoint: newEndpointUrl.trim(),
      apiKey: newEndpointKey.trim() || undefined,
      isLocal: false,
      isEnabled: true,
    });
    setIsAdding(false);
    setShowAddModal(false);
    setNewEndpointName('');
    setNewEndpointUrl('');
    setNewEndpointKey('');
  };

  // Collect all discovered models
  const allModels = providers.flatMap((p) =>
    p.models.map((m) => ({ ...m, providerName: p.name, providerType: p.type }))
  );

  const visionModels = allModels.filter((m) => m.capabilities.includes('vision'));

  return (
    <div className="space-y-4">
      {/* Privacy Guarantee Banner (PM-06, DATA-05) */}
      <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs flex items-start space-x-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-zinc-200">Local Privacy by Default</div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            No video frames, audio, or metadata are sent to the cloud unless you explicitly
            configure a custom cloud endpoint.
          </p>
        </div>
      </div>

      {/* Model Selection Matrix (G2.5, G2.6) */}
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
          Active Task Models
        </div>

        {/* Vision Model Selector */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              <span>Scene Cut Detection Model</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {visionModels.length} available
            </span>
          </div>

          <select
            value={selectedVisionModelId}
            onChange={(e) => setSelectedVisionModelId(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
          >
            <option value="">-- No Vision Model Selected --</option>
            {visionModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.providerName})
              </option>
            ))}
          </select>

          {visionModels.length === 0 && (
            <div className="text-[11px] text-amber-400/90 flex items-center space-x-1.5 pt-0.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                Tip: Run <code className="bg-black/30 px-1 py-0.5 rounded">ollama run minicpm-v</code> or <code className="bg-black/30 px-1 py-0.5 rounded">ollama run llava</code> for vision.
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Configured Providers List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-zinc-400">
            Providers & Endpoints
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Endpoint</span>
          </button>
        </div>

        {/* Ollama Local Card */}
        {ollamaProvider && (
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Server className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex items-center space-x-2">
                    <span>{ollamaProvider.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-zinc-400">
                      Local
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {ollamaProvider.endpoint}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {ollamaProvider.status === 'connected' ? (
                  <span className="flex items-center space-x-1 text-[11px] text-emerald-400 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{ollamaProvider.latencyMs || 0}ms</span>
                  </span>
                ) : ollamaProvider.status === 'checking' ? (
                  <span className="text-[11px] text-blue-400 font-mono animate-pulse">
                    Checking...
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-[11px] text-rose-400 font-mono">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Offline</span>
                  </span>
                )}

                <button
                  disabled={isRefreshing}
                  onClick={handleRefreshOllama}
                  title="Refresh Ollama Models"
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`}
                  />
                </button>
              </div>
            </div>

            {/* Models list under Ollama */}
            {ollamaProvider.models.length > 0 ? (
              <div className="space-y-1 pt-1 border-t border-white/5">
                {ollamaProvider.models.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-black/20 font-mono"
                  >
                    <span className="text-zinc-300 truncate">{m.name}</span>
                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      {m.capabilities.map((c) => (
                        <span
                          key={c}
                          className={`text-[9px] px-1.5 py-0.2 rounded uppercase ${
                            c === 'vision'
                              ? 'bg-purple-500/20 text-purple-300'
                              : c === 'text'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {c}
                        </span>
                      ))}
                      {m.parameterSize && (
                        <span className="text-[9px] text-zinc-500 ml-1">
                          {m.parameterSize}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-zinc-500 italic pt-1">
                No models currently detected in Ollama. Run <code className="text-zinc-300">ollama pull &lt;model&gt;</code> in your terminal.
              </div>
            )}
          </div>
        )}

        {/* Custom Endpoints */}
        {providers
          .filter((p) => p.type !== 'ollama')
          .map((cp) => (
            <div
              key={cp.id}
              className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center space-x-2">
                    <span>{cp.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      Cloud / Paid
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 truncate max-w-[240px]">
                    {cp.endpoint}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {cp.status === 'connected' ? (
                    <span className="flex items-center space-x-1 text-[11px] text-emerald-400 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{cp.latencyMs}ms</span>
                    </span>
                  ) : cp.status === 'checking' ? (
                    <span className="text-[11px] text-blue-400 font-mono animate-pulse">
                      Checking...
                    </span>
                  ) : (
                    <span
                      className="flex items-center space-x-1 text-[11px] text-rose-400 font-mono"
                      title={cp.errorMessage}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Failed</span>
                    </span>
                  )}
                  <button
                    onClick={() => removeProvider(cp.id)}
                    className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove Provider"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Model list under Custom Provider */}
              {cp.models.length > 0 ? (
                <div className="space-y-1 pt-1 border-t border-white/5">
                  {cp.models.slice(0, 6).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-black/20 font-mono"
                    >
                      <span className="text-zinc-300 truncate">{m.name}</span>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        {m.capabilities.map((c) => (
                          <span
                            key={c}
                            className={`text-[9px] px-1.5 py-0.2 rounded uppercase ${
                              c === 'vision'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {cp.models.length > 6 && (
                    <div className="text-[10px] text-zinc-500 text-center pt-0.5">
                      + {cp.models.length - 6} more models available in selectors above
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500 italic pt-1 border-t border-white/5">
                  No models returned. Verify API key and network connection.
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Add Custom Endpoint Modal / Inline Form */}
      {showAddModal && (
        <form
          onSubmit={handleAddCustom}
          className="p-4 rounded-2xl bg-zinc-900 border border-blue-500/30 space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Add Cloud / Paid Provider Endpoint
            </span>
          </div>

          {/* 1-Click Provider Presets */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
              Quick Presets
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { name: 'OpenAI (GPT-4o)', url: 'https://api.openai.com/v1' },
                { name: 'OpenRouter (All Models)', url: 'https://openrouter.ai/api/v1' },
                { name: 'Groq (Ultra-fast)', url: 'https://api.groq.com/openai/v1' },
                { name: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
              ].map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  onClick={() => {
                    setNewEndpointName(preset.name.split(' ')[0]);
                    setNewEndpointUrl(preset.url);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-black/40 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-zinc-200">{preset.name}</div>
                  <div className="text-[9px] font-mono text-zinc-500 truncate">{preset.url}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[11px] text-zinc-400">Endpoint Name</label>
            <input
              type="text"
              placeholder="e.g. OpenAI / OpenRouter / Groq"
              value={newEndpointName}
              onChange={(e) => setNewEndpointName(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-zinc-400">Endpoint Base URL</label>
            <input
              type="url"
              placeholder="http://localhost:1234/v1"
              value={newEndpointUrl}
              onChange={(e) => setNewEndpointUrl(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-zinc-400">
              API Key (Optional / Never logged)
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={newEndpointKey}
              onChange={(e) => setNewEndpointKey(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-40"
            >
              {isAdding ? 'Testing...' : 'Add Endpoint'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
