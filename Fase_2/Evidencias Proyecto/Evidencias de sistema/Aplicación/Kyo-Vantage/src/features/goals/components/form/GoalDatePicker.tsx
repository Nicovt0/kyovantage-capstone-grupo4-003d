import { DatePicker, HeroUIProvider, type DatePickerProps } from '@heroui/react';
import { parseDate } from '@internationalized/date';

// HeroUI and the app resolve different copies of the same calendar-date library.
// Its runtime interface is identical; adapt the nominal private-field type at this boundary.
type PickerDate=NonNullable<DatePickerProps['value']>;
const calendarDate=(value:string)=>parseDate(value.slice(0,10)) as unknown as PickerDate;
export function GoalDatePicker({value,min,onChange}:{value:string;min:string;onChange:(value:string)=>void}) {
  return <HeroUIProvider locale="es-CL">
    <DatePicker<PickerDate> label="Fecha objetivo" value={value ? calendarDate(value) : null} minValue={parseDate(min) as unknown as DatePickerProps['minValue']}
      onChange={(date:{toString():string}|null)=>onChange(date?.toString() || '')} isRequired showMonthAndYearPickers granularity="day"
      selectorButtonProps={{'aria-label':'Abrir calendario'}}
      popoverProps={{classNames:{content:'bg-default-50 text-foreground border border-default-200',base:'z-[100]'}}}
      classNames={{inputWrapper:'rounded-xl border border-default-200 bg-default-100',label:'text-xs font-semibold uppercase text-default-500'}} />
  </HeroUIProvider>;
}
