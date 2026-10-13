<?php

namespace App\Filament\Pages;

use App\Models\MenuGroup;
use App\Models\MenuItem;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * GammonTV Menü — gammontv.com (EN) menüsünü SADELEŞTİR: her sayfayı gammon'da göster/gizle +
 * üst grup isimlerini gammon'a özel değiştir. tavlatv.com ETKİLENMEZ.
 *
 * Değerler menu_items.gammon_visible + menu_groups.gammon_visible/gammon_label'da tutulur.
 * NULL = tavlatv'den miras. MenuController host=gammon iken bu override'ları uygular (frontend
 * değişmez). Kaydederken: toggle tavlatv değeriyle AYNIYSA null (miras korunur), farklıysa açık değer.
 */
class GammonTvMenu extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-bars-3-bottom-left';

    protected static ?string $navigationLabel = 'GammonTV Menü';

    protected static ?string $title = 'GammonTV Menü (sadeleştir)';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 4;

    protected static string $view = 'filament.pages.gammon-tv-menu';

    public ?array $data = [];

    /** @var \Illuminate\Support\Collection<int,MenuGroup>|null */
    private $groupsCache = null;

    /** @var \Illuminate\Support\Collection<int,MenuItem>|null */
    private $itemsCache = null;

    private ?array $catGroup = null; // key => varsayılan grup (config/menu.php)

    private ?array $catLabel = null; // key => varsayılan (TR) etiket

    /** Silinmemiş gruplar, menü sırasıyla. */
    private function groups()
    {
        return $this->groupsCache ??= MenuGroup::where('removed', false)
            ->orderBy('sort')->orderBy('id')->get();
    }

    private function items()
    {
        return $this->itemsCache ??= MenuItem::orderBy('sort')->orderBy('id')->get();
    }

    private function loadCatalog(): void
    {
        if ($this->catGroup !== null) {
            return;
        }
        $this->catGroup = [];
        $this->catLabel = [];
        foreach ((array) config('menu.items', []) as $row) {
            $this->catGroup[$row['key']] = $row['group'] ?? null;
            $this->catLabel[$row['key']] = $row['label'] ?? $row['key'];
        }
    }

    /** Öğenin etkin grubu: admin override (item.group) yoksa katalog varsayılanı. */
    private function groupKeyOf(MenuItem $m): ?string
    {
        $this->loadCatalog();

        return $m->group ?: ($this->catGroup[$m->key] ?? null);
    }

    /** Gammon'da gösterilecek sayfa etiketi: EN varsa o, yoksa katalog varsayılanı, yoksa key. */
    private function itemLabel(MenuItem $m): string
    {
        $this->loadCatalog();

        return $m->label_en ?: ($this->catLabel[$m->key] ?? $m->key);
    }

    private function groupDisplayName(MenuGroup $g): string
    {
        return $g->gammon_label ?: ($g->label_en ?: $g->key);
    }

    public function mount(): void
    {
        $state = [];
        foreach ($this->groups() as $g) {
            $state["g_{$g->id}_label"] = $g->gammon_label;
            $state["g_{$g->id}_vis"] = $g->gammon_visible !== null ? $g->gammon_visible : (bool) $g->visible;
        }
        foreach ($this->items() as $m) {
            $state["i_{$m->id}_vis"] = $m->gammon_visible !== null ? $m->gammon_visible : (bool) $m->visible;
        }
        $this->form->fill($state);
    }

    public function form(Form $form): Form
    {
        // Öğeleri etkin gruba göre kümele.
        $byGroup = [];
        foreach ($this->items() as $m) {
            $byGroup[$this->groupKeyOf($m) ?? '_none'][] = $m;
        }

        $sections = [];
        foreach ($this->groups() as $g) {
            $groupItems = $byGroup[$g->key] ?? [];
            $fields = [
                TextInput::make("g_{$g->id}_label")
                    ->label('Grup ismi (gammon)')
                    ->placeholder($g->label_en ?: $g->key)
                    ->helperText('Boş = tavlatv İngilizce etiketi kullanılır.')
                    ->maxLength(40),
                Toggle::make("g_{$g->id}_vis")
                    ->label('Grup gammon\'da görünsün')
                    ->inline(false),
            ];
            foreach ($groupItems as $m) {
                $fields[] = Toggle::make("i_{$m->id}_vis")
                    ->label($this->itemLabel($m))
                    ->inline(false);
            }
            $sections[] = Section::make($this->groupDisplayName($g))
                ->description('Üst grup ismi + altındaki sayfaların gammon görünürlüğü')
                ->schema($fields)
                ->columns(2)
                ->collapsible();
        }

        // Hiçbir (silinmemiş) gruba düşmeyen öğeler — yine de yönetilebilsin.
        if (! empty($byGroup['_none'])) {
            $fields = [];
            foreach ($byGroup['_none'] as $m) {
                $fields[] = Toggle::make("i_{$m->id}_vis")->label($this->itemLabel($m))->inline(false);
            }
            $sections[] = Section::make('Gruplanmamış')->schema($fields)->columns(2)->collapsible()->collapsed();
        }

        return $form->schema($sections)->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        foreach ($this->groups() as $g) {
            $label = trim((string) ($data["g_{$g->id}_label"] ?? ''));
            $vis = (bool) ($data["g_{$g->id}_vis"] ?? true);
            $g->gammon_label = $label === '' ? null : $label;
            // tavlatv ile AYNIYSA null (miras); farklıysa açık override.
            $g->gammon_visible = $vis === (bool) $g->visible ? null : $vis;
            $g->save();
        }
        foreach ($this->items() as $m) {
            $vis = (bool) ($data["i_{$m->id}_vis"] ?? true);
            $m->gammon_visible = $vis === (bool) $m->visible ? null : $vis;
            $m->save();
        }

        Notification::make()
            ->title('GammonTV menüsü kaydedildi')
            ->body('Yalnız gammontv.com etkilenir; tavlatv.com menüsü değişmez.')
            ->success()
            ->send();
    }
}
