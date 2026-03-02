import { z } from 'zod'

export const createUserSchema = z.object({
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['admin', 'receptionist', 'host'], { message: 'Pilih role' }),
  phone: z.string().optional().default(''),
  department: z.string().optional().default(''),
})

export type CreateUserData = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
  role: z.enum(['admin', 'receptionist', 'host'], { message: 'Pilih role' }),
  phone: z.string().optional().default(''),
  department: z.string().optional().default(''),
  is_active: z.boolean(),
})

export type UpdateUserData = z.infer<typeof updateUserSchema>
