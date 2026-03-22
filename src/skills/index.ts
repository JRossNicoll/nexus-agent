import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { watch } from 'chokidar';
import type { Skill, SkillConfig, SkillTrigger } from '../types/index.js';

const SKILLS_DIR = path.join(process.env.HOME ?? '~', '.nexus', 'skills');

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private watcher: ReturnType<typeof watch> | null = null;
  private onReloadCallback: (() => void) | null = null;

  constructor() {
    this.ensureSkillsDir();
  }

  private ensureSkillsDir(): void {
    if (!fs.existsSync(SKILLS_DIR)) {
      fs.mkdirSync(SKILLS_DIR, { recursive: true });
    }
  }

  loadSkills(): void {
    this.skills.clear();
    if (!fs.existsSync(SKILLS_DIR)) return;

    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(SKILLS_DIR, file);
      this.loadSkillFile(filePath);
    }
  }

  private loadSkillFile(filePath: string): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);

      const config: SkillConfig = {
        name: (data.name as string) ?? path.basename(filePath, '.md'),
        description: (data.description as string) ?? '',
        triggers: this.parseTriggers(data.triggers as Array<Record<string, string>> | undefined),
        tools: (data.tools as string[]) ?? [],
        enabled: data.enabled !== false,
      };

      this.skills.set(config.name, {
        config,
        content: content.trim(),
        filePath,
      });
    } catch (error) {
      console.error(`Failed to load skill from ${filePath}:`, error);
    }
  }

  private parseTriggers(raw: Array<Record<string, string>> | undefined): SkillTrigger[] {
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map(t => ({
      cron: t.cron,
      keyword: t.keyword,
    }));
  }

  startWatching(onReload?: () => void): void {
    this.onReloadCallback = onReload ?? null;
    this.watcher = watch(SKILLS_DIR, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500 },
    });

    this.watcher.on('add', (filePath: string) => {
      if (filePath.endsWith('.md')) {
        console.log(`Skill added: ${filePath}`);
        this.loadSkillFile(filePath);
        this.onReloadCallback?.();
      }
    });

    this.watcher.on('change', (filePath: string) => {
      if (filePath.endsWith('.md')) {
        console.log(`Skill changed: ${filePath}`);
        this.loadSkillFile(filePath);
        this.onReloadCallback?.();
      }
    });

    this.watcher.on('unlink', (filePath: string) => {
      if (filePath.endsWith('.md')) {
        const name = path.basename(filePath, '.md');
        this.skills.delete(name);
        console.log(`Skill removed: ${name}`);
        this.onReloadCallback?.();
      }
    });
  }

  stopWatching(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getEnabledSkills(): Skill[] {
    return this.getAllSkills().filter(s => s.config.enabled);
  }

  getSkillsByKeyword(keyword: string): Skill[] {
    const lower = keyword.toLowerCase();
    return this.getEnabledSkills().filter(skill =>
      skill.config.triggers.some(t =>
        t.keyword && lower.includes(t.keyword.toLowerCase())
      )
    );
  }

  getCronSkills(): Array<{ skill: Skill; cron: string }> {
    const result: Array<{ skill: Skill; cron: string }> = [];
    for (const skill of this.getEnabledSkills()) {
      for (const trigger of skill.config.triggers) {
        if (trigger.cron) {
          result.push({ skill, cron: trigger.cron });
        }
      }
    }
    return result;
  }

  createSkill(name: string, content: string, config: Partial<SkillConfig>): string {
    const filePath = path.join(SKILLS_DIR, `${name}.md`);
    const frontmatter: Record<string, unknown> = {
      name,
      description: config.description ?? '',
      triggers: config.triggers ?? [],
      tools: config.tools ?? [],
      enabled: config.enabled !== false,
    };

    const md = matter.stringify(content, frontmatter);
    fs.writeFileSync(filePath, md, 'utf-8');
    this.loadSkillFile(filePath);
    return filePath;
  }

  updateSkill(name: string, content: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;

    fs.writeFileSync(skill.filePath, content, 'utf-8');
    this.loadSkillFile(skill.filePath);
    return true;
  }

  deleteSkill(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;

    fs.unlinkSync(skill.filePath);
    this.skills.delete(name);
    return true;
  }

  toggleSkill(name: string, enabled: boolean): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;

    const raw = fs.readFileSync(skill.filePath, 'utf-8');
    const { data, content } = matter(raw);
    data.enabled = enabled;
    const md = matter.stringify(content, data);
    fs.writeFileSync(skill.filePath, md, 'utf-8');
    this.loadSkillFile(skill.filePath);
    return true;
  }

  getSkillsDir(): string {
    return SKILLS_DIR;
  }
}
