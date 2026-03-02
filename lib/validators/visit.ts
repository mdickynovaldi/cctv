import { z } from 'zod'

export const visitFormSchema = z.object({
  visitor_name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama terlalu panjang'),
  visitor_email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  visitor_phone: z
    .string()
    .min(10, 'Nomor HP minimal 10 digit')
    .max(15, 'Nomor HP terlalu panjang')
    .regex(/^(08|\+62)\d+$/, 'Format HP: 08xxx atau +62xxx'),
  purpose: z.string().min(3, 'Tujuan kunjungan minimal 3 karakter').max(500, 'Terlalu panjang'),
  host_id: z.string().uuid('Pilih host yang dituju'),
  planned_date: z.string().min(1, 'Tanggal kunjungan wajib diisi'),
  planned_time: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export type VisitFormData = z.infer<typeof visitFormSchema>

export const walkInFormSchema = visitFormSchema.extend({
  // Walk-in might not have email
  visitor_email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
})

export const searchVisitorSchema = z.object({
  query: z.string().min(2, 'Minimal 2 karakter untuk pencarian'),
})

export const hostFormSchema = z.object({
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().optional(),
  department: z.string().optional(),
})

export type HostFormData = z.infer<typeof hostFormSchema>
