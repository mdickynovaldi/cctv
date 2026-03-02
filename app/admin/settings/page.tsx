import { Settings, Clock, Database, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-blue-400" />
          Pengaturan
        </h1>
        <p className="text-slate-400 text-sm mt-1">Konfigurasi sistem VMS</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Office Hours */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Jam Operasional
            </CardTitle>
            <CardDescription className="text-slate-400">
              Atur jam buka-tutup kantor untuk validasi kunjungan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Jam Buka</Label>
                <Input type="time" defaultValue="08:00"
                  className="bg-slate-800/50 border-slate-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Jam Tutup</Label>
                <Input type="time" defaultValue="17:00"
                  className="bg-slate-800/50 border-slate-700 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto No-Show */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Kebijakan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Auto No-Show</p>
                <p className="text-xs text-slate-400">Otomatis tandai No-Show jika visitor tidak datang</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-slate-800" />
            <div className="space-y-2">
              <Label className="text-slate-300">Timeout No-Show (jam)</Label>
              <Input type="number" defaultValue="24" min="1" max="72"
                className="w-24 bg-slate-800/50 border-slate-700 text-white" />
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Retensi Data
            </CardTitle>
            <CardDescription className="text-slate-400">
              Data kunjungan lebih lama dari periode ini akan dihapus otomatis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-slate-300">Retensi (hari)</Label>
              <Input type="number" defaultValue="365" min="30" max="1825"
                className="w-32 bg-slate-800/50 border-slate-700 text-white" />
            </div>
          </CardContent>
        </Card>

        <Button className="bg-blue-600 hover:bg-blue-500 w-full">
          Simpan Pengaturan
        </Button>
      </div>
    </div>
  )
}
