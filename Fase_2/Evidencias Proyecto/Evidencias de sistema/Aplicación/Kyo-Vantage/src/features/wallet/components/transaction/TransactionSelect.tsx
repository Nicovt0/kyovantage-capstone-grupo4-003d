import type { ReactNode } from 'react';
import { Select, SelectItem } from '@heroui/react';
import { Plus } from 'lucide-react';

export interface TransactionOption {
  id: string;
  name: string;
  detail?: string;
  icon: ReactNode;
}

function OptionContent({ option }: { option: TransactionOption }) {
  return <span className="flex w-full min-w-0 items-center gap-3">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-raised">{option.icon}</span>
    <span className="flex min-w-0 flex-1 flex-col text-left"><span className="truncate text-sm text-on-background">{option.name}</span>{option.detail && <span className="truncate text-[11px] text-on-surface-card-secondary">{option.detail}</span>}</span>
  </span>;
}

export function TransactionSelect({ label, value, options, onChange, disabled, placeholder, onCreate }: {
  label: string; value: string; options: TransactionOption[]; onChange: (id: string) => void; disabled?: boolean; placeholder: string; onCreate?: () => void;
}) {
  const selected = options.find(option => option.id === value);
  const items: TransactionOption[] = onCreate ? [...options, {id:'__create_category__',name:'Crear categoría',icon:<Plus size={17}/>}]:options;
  return <div className="flex min-w-0 flex-col gap-1.5">
    <span className="text-xs font-medium text-on-surface-card-secondary">{label}</span>
    <Select aria-label={label} placeholder={placeholder} isRequired isDisabled={disabled}
      selectedKeys={selected ? [selected.id] : []} onSelectionChange={keys => { const key=String(Array.from(keys)[0] || ''); if(key==='__create_category__' && onCreate) onCreate(); else onChange(key); }}
      renderValue={() => selected ? <OptionContent option={selected} /> : null}
      classNames={{ trigger: 'relative h-auto min-h-14 rounded-xl border border-border-subtle bg-surface-card px-3 py-2 shadow-none data-[hover=true]:bg-surface-raised data-[open=true]:border-kyo-lightPurple', value: 'pr-5 text-on-background', selectorIcon: 'absolute left-auto right-3 top-1/2 -translate-y-1/2 text-on-surface-card-secondary', popoverContent: 'z-[100] rounded-xl border border-border-subtle bg-surface-card p-1 text-on-background shadow-xl', listboxWrapper: 'max-h-64' }}
      popoverProps={{ classNames: { base: 'z-[100]', content: 'rounded-xl border border-border-subtle bg-surface-card p-1 text-on-background shadow-xl' } }}>
      {items.map(option => <SelectItem key={option.id} textValue={`${option.name} ${option.detail || ''}`} className="rounded-lg px-2 py-2 data-[hover=true]:bg-surface-raised data-[focus=true]:bg-surface-raised data-[selected=true]:bg-brand-primary/15"><OptionContent option={option} /></SelectItem>)}
    </Select>
  </div>;
}
