'use server'

import { prisma } from '@/src/lib/db';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { getCodeForCategory } from './utils/categoryCode';
import { normalizeArticleSearch } from '@/src/lib/search-utils';
import {
  findRelatedLawCandidates,
  generateLawGroupId,
} from '@/src/lib/law-grouping';

async function resolveLawGroupId(input: {
  title: string;
  selectedLawGroupId?: string | null;
  selectedLawId?: number | null;
}) {
  if (input.selectedLawGroupId) {
    return {
      lawGroupId: input.selectedLawGroupId,
      recommendedLawId: input.selectedLawId ?? null,
      autoMatched: false,
    };
  }

  const allLaws = await prisma.law.findMany({
    select: {
      id: true,
      title: true,
      lawGroupId: true,
      effectiveDate: true,
      promulgationDate: true,
      status: true,
      level: true,
    }
  });

  const match = findRelatedLawCandidates(input.title, allLaws);
  const recommended = match.recommended;

  if (recommended?.shouldAutoSelect && recommended.lawGroupId) {
    return {
      lawGroupId: recommended.lawGroupId,
      recommendedLawId: recommended.id,
      autoMatched: true,
    };
  }

  return {
    lawGroupId: generateLawGroupId(input.title),
    recommendedLawId: null,
    autoMatched: false,
  };
}

export async function exportLawsToJson() {
  try {
    const laws = await prisma.law.findMany({
      include: {
        articles: {
          orderBy: { order: 'asc' },
          include: {
            paragraphs: {
              orderBy: { order: 'asc' },
              include: {
                items: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    // 导出到单独文件夹，避免覆盖原始 JSON 文件
    const outputDir = path.join(process.cwd(), 'laws-exported');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 格式化日期为 YYYY-MM-DD
    const formatDate = (date: Date | null) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    };

    for (const law of laws) {
      // 完整结构化导出
      const jsonContent = {
        meta: {
          version: '1.6.5',
          exported_at: new Date().toISOString(),
          format: 'complete',
          description: '完整结构化导出，包含所有元数据和条款层级结构'
        },
        law: {
          id: law.id,
          title: law.title,
          issuing_authority: law.issuingAuthority,
          document_number: law.documentNumber,
          preamble: law.preamble,
          promulgation_date: formatDate(law.promulgationDate),
          effective_date: formatDate(law.effectiveDate),
          status: law.status,
          level: law.level,
          category: law.category,
          region: law.region,
          law_group_id: law.lawGroupId
        },
        structure: {
          articles: law.articles.map(a => ({
            order: a.order,
            chapter: a.chapter,
            section: a.section,
            title: a.title,
            paragraphs: a.paragraphs.map(p => ({
              order: p.order,
              number: p.number,
              content: p.content,
              items: p.items.map(i => ({
                order: i.order,
                number: i.number,
                content: i.content
              }))
            }))
          }))
        }
      };

      const filePath = path.join(outputDir, `${law.title}.json`);
      fs.writeFileSync(filePath, JSON.stringify(jsonContent, null, 2));
    }

    return { success: true, message: `成功导出 ${laws.length} 个法规到 laws-exported 目录\n\n说明：\n- 完整结构化格式（包含所有元数据和条款层级）\n- 原始 laws 文件未被覆盖\n- 导出时间: ${new Date().toLocaleString('zh-CN')}` };
  } catch (error: any) {
    console.error('Export failed:', error);
    throw new Error('导出失败: ' + error.message);
  }
}

export async function updateLaw(id: number, data: any) {
  // 如果包含日期字段，转换为 Date 对象
  const formattedData = { ...data };
  if (data.promulgationDate) formattedData.promulgationDate = new Date(data.promulgationDate);
  if (data.effectiveDate) formattedData.effectiveDate = new Date(data.effectiveDate);

  await prisma.law.update({
    where: { id },
    data: formattedData,
  });
  
  revalidatePath('/admin/laws');
  revalidatePath('/');
  revalidatePath(`/law/${id}`);
}

export async function deleteLaw(id: number) {
  await prisma.law.delete({ where: { id } });
  revalidatePath('/admin/laws');
  revalidatePath('/');
}

export async function createLaw(data: any): Promise<number> {
  // 使用事务确保数据一致性
  let lawId: number;  // 用于保存创建的法规ID
  const resolvedGroup = await resolveLawGroupId({
    title: data.title,
    selectedLawGroupId: data.lawGroupId,
    selectedLawId: data.selectedLawId,
  });

  await prisma.$transaction(async (tx) => {
    // 创建 Law
    const law = await tx.law.create({
      data: {
        title: data.title,
        preamble: data.preamble,
        issuingAuthority: data.issuingAuthority,
        documentNumber: data.documentNumber,
        promulgationDate: data.promulgationDate ? new Date(data.promulgationDate) : null,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        status: data.status || '现行有效',
        level: data.level,
        category: data.category,
        region: data.region || '全国',
        lawGroupId: resolvedGroup.lawGroupId,
      }
    });

    // 保存法规ID
    lawId = law.id;

    // 如果新法规有公布日期，将同组其他版本改为"已被修改"
    // 说明：新法规已公布就意味着旧版本即将被替代，无论新法规是否已生效
    if (data.promulgationDate) {
      const newPromulgationDate = new Date(data.promulgationDate);

      // 查找同 lawGroupId 的所有法规（不包括刚创建的）
      const sameGroupLaws = await tx.law.findMany({
        where: {
          lawGroupId: resolvedGroup.lawGroupId,
          id: { not: law.id }, // 直接使用 law.id（在事务内部）
          status: '现行有效', // 只处理当前为"现行有效"的法规
        },
        select: {
          id: true,
          promulgationDate: true,
          effectiveDate: true,
        },
      });

      // 将公布日期早于新法规的法规改为"已被修改"
      for (const oldLaw of sameGroupLaws) {
        const oldPromulgationDate = oldLaw.promulgationDate ? new Date(oldLaw.promulgationDate) : null;
        if (oldPromulgationDate && oldPromulgationDate < newPromulgationDate) {
          await tx.law.update({
            where: { id: oldLaw.id },
            data: { status: '已被修改' },
          });
          // 刷新相关路径的缓存
          revalidatePath(`/law/${oldLaw.id}`);
        }
      }
    }

    // 创建条款（包含款和项）
    if (data.articles && data.articles.length > 0) {
      for (const articleData of data.articles) {
        // 创建条
        const article = await tx.article.create({
          data: {
            lawId: law.id,
            chapter: articleData.chapter || null,
            section: articleData.section || null,
            title: articleData.title,
            order: articleData.order,
          }
        });

        // 如果有款，创建款
        if (articleData.paragraphs && articleData.paragraphs.length > 0) {
          for (const paraData of articleData.paragraphs) {
            const paragraph = await tx.paragraph.create({
              data: {
                articleId: article.id,
                number: paraData.number,
                content: paraData.content || null,
                order: paraData.order,
              }
            });

            // 如果有项，创建项
            if (paraData.items && paraData.items.length > 0) {
              await tx.item.createMany({
                data: paraData.items.map((itemData: any) => ({
                  paragraphId: paragraph.id,
                  number: itemData.number,
                  content: itemData.content,
                  order: itemData.order,
                }))
              });
            }
          }
        }
      }
    }
  }, {
    maxWait: 10000,  // 最大等待时间：10秒
    timeout: 30000,  // 事务超时时间：30秒
  });

  // 事务成功完成后，lawId 一定已赋值
  revalidatePath('/admin/laws');
  revalidatePath('/');
  revalidatePath(`/law/${lawId!}`);  // 使用非空断言（事务成功后一定有值）

  return lawId!;
}

// 获取法规完整数据（包括所有条款、款、项）
export async function getLawWithArticles(id: number) {
  const law = await prisma.law.findUnique({
    where: { id },
    include: {
      articles: {
        orderBy: { order: 'asc' },
        include: {
          paragraphs: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      }
    }
  });
  return law;
}

// 搜索法规（用于关联现有法规）
export async function searchLaws(keyword: string) {
  if (!keyword || keyword.trim().length < 2) {
    return [];
  }

  const laws = await prisma.law.findMany({
    where: {
      title: {
        contains: keyword.trim()
        // SQLite 不支持 mode: 'insensitive'，需要区分大小写
      }
    },
    select: {
      id: true,
      title: true,
      lawGroupId: true,
      effectiveDate: true,
      promulgationDate: true,
      status: true,
      level: true
    },
    orderBy: {
      effectiveDate: 'desc'
    },
    take: 20 // 限制返回20条结果
  });

  return laws;
}

export async function findRelatedLaws(title: string, excludeLawId?: number) {
  if (!title || title.trim().length < 2) {
    return {
      inputTitle: title,
      normalizedTitle: title.trim(),
      baseTitle: title.trim(),
      recommended: null,
      candidates: [],
    };
  }

  const laws = await prisma.law.findMany({
    select: {
      id: true,
      title: true,
      lawGroupId: true,
      effectiveDate: true,
      promulgationDate: true,
      status: true,
      level: true,
    },
    orderBy: {
      effectiveDate: 'desc'
    }
  });

  return findRelatedLawCandidates(title, laws, { excludeLawId });
}

// 更新法规全文（更新Law + 替换所有Articles，包含Paragraphs和Items）
export async function updateLawWithArticles(id: number, data: any) {
  // 使用事务确保数据一致性
  await prisma.$transaction(async (tx) => {
    // 1. 更新 Law 表的元数据
    await tx.law.update({
      where: { id },
      data: {
        title: data.title,
        preamble: data.preamble,
        issuingAuthority: data.issuingAuthority,
        documentNumber: data.documentNumber,
        promulgationDate: data.promulgationDate ? new Date(data.promulgationDate) : null,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        status: data.status || '现行有效',
        level: data.level,
        category: data.category,
        region: data.region || '全国',
        ...(data.lawGroupId !== undefined && { lawGroupId: data.lawGroupId }),
      }
    });

    // 2. 删除该法规的所有旧条款（级联删除paragraphs和items）
    await tx.article.deleteMany({
      where: { lawId: id }
    });

    // 3. 顺序创建新的条款（使用嵌套创建减少数据库往返）
    if (data.articles && data.articles.length > 0) {
      for (const articleData of data.articles) {
        await tx.article.create({
          data: {
            lawId: id,
            chapter: articleData.chapter || null,
            section: articleData.section || null,
            title: articleData.title,
            order: articleData.order,
            paragraphs: articleData.paragraphs && articleData.paragraphs.length > 0
              ? {
                  create: articleData.paragraphs.map((paraData: any) => ({
                    number: paraData.number,
                    content: paraData.content || null,
                    order: paraData.order,
                    items: paraData.items && paraData.items.length > 0
                      ? {
                          create: paraData.items.map((itemData: any) => ({
                            number: itemData.number,
                            content: itemData.content,
                            order: itemData.order,
                          }))
                        }
                      : undefined,
                  }))
                }
              : undefined,
          }
        });
      }
    }
  }, {
    maxWait: 10000,  // 最大等待时间：10秒
    timeout: 120000, // 事务超时时间：120秒
  });

  revalidatePath('/admin/laws');
  revalidatePath('/');
  revalidatePath(`/law/${id}`);
}

/**
 * 获取同一法规组内的所有法规
 */
export async function getLawGroupMembers(lawGroupId: string) {
  if (!lawGroupId) {
    return [];
  }

  const members = await prisma.law.findMany({
    where: { lawGroupId },
    select: {
      id: true,
      title: true,
      effectiveDate: true,
      promulgationDate: true,
      status: true,
    },
    orderBy: { effectiveDate: 'desc' }
  });

  return members;
}

/**
 * 创建独立的法规组（从当前组分离）
 */
export async function createIndependentLawGroup(lawId: number) {
  const law = await prisma.law.findUnique({
    where: { id: lawId },
    select: { title: true, lawGroupId: true }
  });

  if (!law) {
    throw new Error('法规不存在');
  }

  // 生成新的 lawGroupId
  const newGroupId = generateLawGroupId(law.title);

  // 更新法规的 lawGroupId
  await prisma.law.update({
    where: { id: lawId },
    data: { lawGroupId: newGroupId }
  });

  // 刷新相关路径
  revalidatePath(`/admin/edit/${lawId}`);
  revalidatePath(`/law/${lawId}`);

  return {
    success: true,
    oldGroupId: law.lawGroupId,
    newGroupId: newGroupId
  };
}

/**
 * 合并到其他法规组
 */
export async function mergeIntoLawGroup(lawId: number, targetGroupId: string) {
  const law = await prisma.law.findUnique({
    where: { id: lawId },
    select: { title: true, lawGroupId: true }
  });

  if (!law) {
    throw new Error('法规不存在');
  }

  // 更新法规的 lawGroupId
  await prisma.law.update({
    where: { id: lawId },
    data: { lawGroupId: targetGroupId }
  });

  // 刷新相关路径
  revalidatePath(`/admin/edit/${lawId}`);
  revalidatePath(`/law/${lawId}`);

  return {
    success: true,
    oldGroupId: law.lawGroupId,
    newGroupId: targetGroupId
  };
}

// ========== 违法行为管理相关函数 ==========

/**
 * 删除违法行为
 */
export async function deleteViolation(id: number) {
  await prisma.violation.delete({ where: { id } });
  revalidatePath('/admin/violations');
  revalidatePath('/violations');
}

/**
 * 更新违法行为
 */
export async function updateViolation(id: number, data: {
  description: string;
  violationBasisLawId: number | null;
  violationBasisArticleId: number | null;
  violationBasisParagraphId: number | null;
  violationBasisItemId: number | null;
  punishmentBasisLawId: number | null;
  punishmentBasisArticleId: number | null;
  punishmentBasisParagraphId: number | null;
  punishmentBasisItemId: number | null;
  sentencingGuidelines: string | null;
  punishmentSuggestion: string | null;
}) {
  // 检查法规是否改变，如果改变了需要更新编码
  const currentViolation = await prisma.violation.findUnique({
    where: { id },
    select: { violationBasisLawId: true }
  });

  let updateData: any = {
    description: data.description,
    violationBasisLawId: data.violationBasisLawId,
    violationBasisArticleId: data.violationBasisArticleId,
    violationBasisParagraphId: data.violationBasisParagraphId,
    violationBasisItemId: data.violationBasisItemId,
    punishmentBasisLawId: data.punishmentBasisLawId,
    punishmentBasisArticleId: data.punishmentBasisArticleId,
    punishmentBasisParagraphId: data.punishmentBasisParagraphId,
    punishmentBasisItemId: data.punishmentBasisItemId,
    sentencingGuidelines: data.sentencingGuidelines,
    punishmentSuggestion: data.punishmentSuggestion,
  };

  // 如果违法依据法规改变，重新生成编码
  if (currentViolation && data.violationBasisLawId !== currentViolation.violationBasisLawId) {
    if (data.violationBasisLawId) {
      const law = await prisma.law.findUnique({
        where: { id: data.violationBasisLawId },
        select: { category: true }
      });

      if (law?.category) {
        const newCategoryCode = await getCodeForCategory(law.category);

        // 查询该类别下的最大编号
        const lastViolation = await prisma.violation.findFirst({
          where: {
            categoryCode: newCategoryCode,
            code: { not: null },
            id: { not: id } // 排除当前记录
          },
          orderBy: { code: 'desc' }
        });

        let nextNum = 1;
        if (lastViolation?.code) {
          const numStr = lastViolation.code.substring(1);
          const lastNum = parseInt(numStr);
          if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
          }
        }

        updateData.code = `${newCategoryCode}${String(nextNum).padStart(3, '0')}`;
        updateData.categoryCode = newCategoryCode;
      }
    }
  }

  const violation = await prisma.violation.update({
    where: { id },
    data: updateData
  });

  revalidatePath('/admin/violations');
  revalidatePath('/violations');
  revalidatePath(`/admin/violations/${id}/edit`);

  return violation.id;
}

/**
 * 获取法规的所有条款（用于级联选择）
 */
export async function getLawArticlesWithContent(lawId: number) {
  const articles = await prisma.article.findMany({
    where: { lawId },
    select: {
      id: true,
      title: true,
      chapter: true,
      section: true,
      order: true,
      paragraphs: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          number: true,
          content: true,
          items: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              number: true,
              content: true,
            }
          }
        }
      }
    },
    orderBy: { order: 'asc' }
  });

  return articles;
}

export async function getLawArticles(lawId: number) {
  const articles = await prisma.article.findMany({
    where: { lawId },
    select: {
      id: true,
      title: true,
      chapter: true,
      section: true,
      order: true,
      _count: {
        select: {
          paragraphs: true
        }
      }
    },
    orderBy: { order: 'asc' }
  });

  return articles;
}

/**
 * 获取条款的所有款（用于级联选择）
 */
export async function getArticleParagraphs(articleId: number) {
  const paragraphs = await prisma.paragraph.findMany({
    where: { articleId },
    select: {
      id: true,
      number: true,
      content: true,
      order: true,
      _count: {
        select: {
          items: true
        }
      }
    },
    orderBy: { order: 'asc' }
  });

  return paragraphs;
}

/**
 * 获取款的所有项（用于级联选择）
 */
export async function getParagraphItems(paragraphId: number) {
  const items = await prisma.item.findMany({
    where: { paragraphId },
    select: {
      id: true,
      number: true,
      content: true,
      order: true
    },
    orderBy: { order: 'asc' }
  });

  return items;
}

/**
 * 创建违法行为
 */
export async function createViolation(data: {
  description: string;
  violationBasisLawId: number | null;
  violationBasisArticleId: number | null;
  violationBasisParagraphId: number | null;
  violationBasisItemId: number | null;
  punishmentBasisLawId: number | null;
  punishmentBasisArticleId: number | null;
  punishmentBasisParagraphId: number | null;
  punishmentBasisItemId: number | null;
  sentencingGuidelines: string | null;
  punishmentSuggestion: string | null;
}) {
  // 1. 根据选择的法规获取 category
  let categoryCode = 'Z'; // 默认值

  if (data.violationBasisLawId) {
    const law = await prisma.law.findUnique({
      where: { id: data.violationBasisLawId },
      select: { category: true }
    });

    if (law?.category) {
      // 2. 获取该 category 的编码字母
      categoryCode = await getCodeForCategory(law.category);
    }
  }

  // 3. 查询该类别下的最大编号
  const lastViolation = await prisma.violation.findFirst({
    where: {
      categoryCode: categoryCode,
      code: { not: null }
    },
    orderBy: {
      code: 'desc'
    }
  });

  let nextNum = 1;
  if (lastViolation?.code) {
    const numStr = lastViolation.code.substring(1); // 去掉字母 'A'
    const lastNum = parseInt(numStr);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  // 4. 生成新编码
  const code = `${categoryCode}${String(nextNum).padStart(3, '0')}`; // A001, B002...

  const violation = await prisma.violation.create({
    data: {
      code,
      categoryCode,
      description: data.description,
      violationBasisLawId: data.violationBasisLawId,
      violationBasisArticleId: data.violationBasisArticleId,
      violationBasisParagraphId: data.violationBasisParagraphId,
      violationBasisItemId: data.violationBasisItemId,
      punishmentBasisLawId: data.punishmentBasisLawId,
      punishmentBasisArticleId: data.punishmentBasisArticleId,
      punishmentBasisParagraphId: data.punishmentBasisParagraphId,
      punishmentBasisItemId: data.punishmentBasisItemId,
      sentencingGuidelines: data.sentencingGuidelines,
      punishmentSuggestion: data.punishmentSuggestion,
    }
  });

  revalidatePath('/admin/violations');
  revalidatePath('/violations');

  return violation.id;
}

/**
 * 搜索法条内容（用于违法行为录入）
 * 支持搜索Article、Paragraph、Item三个层级
 */
export async function searchLegalProvisions(keyword: string, lawId?: number) {
  if (!keyword || keyword.trim().length < 2) {
    return [];
  }

  // 标准化搜索输入（支持多种格式：第18条、18条、第十八条等）
  const normalizedKeyword = normalizeArticleSearch(keyword.trim());
  const searchTerm = `%${normalizedKeyword}%`;
  const originalSearchTerm = `%${keyword.trim()}%`; // 保留原始输入用于内容搜索
  const results: any[] = [];

  // 如果指定了法规ID，先获取该法规的所有Article ID
  let articleIds: number[] | null = null;
  if (lawId) {
    const articles = await prisma.article.findMany({
      where: { lawId },
      select: { id: true }
    });
    articleIds = articles.map(a => a.id);
  }

  // 1. 搜索Article层（内容在Paragraph中）
  const articles = await prisma.article.findMany({
    where: {
      ...(articleIds && { id: { in: articleIds } }),
      OR: [
        { title: { contains: searchTerm } }, // 标题搜索使用标准化输入
        { paragraphs: { some: { content: { contains: originalSearchTerm } } } } // 内容搜索使用原始输入
      ]
    },
    select: {
      id: true,
      title: true,
      law: {
        select: {
          id: true,
          title: true
        }
      }
    },
    take: 20
  });

  // 转换Article结果
  for (const article of articles) {
    // 获取该Article的所有款内容（用于显示）
    const allParagraphs = await prisma.paragraph.findMany({
      where: { articleId: article.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        number: true,
        content: true,
        items: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            number: true,
            content: true,
            order: true
          }
        }
      }
    });

    // 合并所有款的内容作为预览
    const contentPreview = allParagraphs.map(p => p.content).join('\n');

    results.push({
      id: `article-${article.id}`,
      level: 'article',
      lawTitle: article.law.title,
      lawId: article.law.id,
      articleTitle: article.title,
      articleId: article.id,
      paragraphId: null,
      itemId: null,
      content: contentPreview,
      displayText: `第${article.title}条`, // 添加"第"和"条"字
      breadcrumb: `${article.law.title} > 第${article.title}条`,
      // 附加所有Paragraph数据，用于前端显示
      allParagraphs: allParagraphs
    });
  }

  // 2. 搜索Paragraph层
  const paragraphs = await prisma.paragraph.findMany({
    where: {
      content: { contains: searchTerm },
      ...(articleIds && { articleId: { in: articleIds } })
    },
    select: {
      id: true,
      number: true,
      content: true,
      article: {
        select: {
          id: true,
          title: true,
          law: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }
    },
    take: 20
  });

  // 转换Paragraph结果
  const chineseNumbers = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

  for (const para of paragraphs) {
    const cnNum = chineseNumbers[para.number] || para.number.toString();

    // 获取该Article的所有Paragraph（用于前端显示所有款）
    const allParagraphs = await prisma.paragraph.findMany({
      where: { articleId: para.article.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        number: true,
        content: true,
        order: true,
        items: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            number: true,
            content: true,
            order: true
          }
        }
      }
    });

    results.push({
      id: `paragraph-${para.id}`,
      level: 'paragraph',
      lawTitle: para.article.law.title,
      lawId: para.article.law.id,
      articleTitle: para.article.title,
      articleId: para.article.id,
      paragraphId: para.id,
      itemId: null,
      content: para.content,
      displayText: `第${para.article.title}条第${cnNum}款`, // 添加"第"和"条"字
      breadcrumb: `${para.article.law.title} > 第${para.article.title}条 > 第${cnNum}款`,
      // 附加所有Paragraph数据，用于前端显示
      allParagraphs: allParagraphs
    });
  }

  // 3. 搜索Item层
  const items = await prisma.item.findMany({
    where: {
      content: { contains: searchTerm },
      ...(articleIds && {
        paragraph: {
          articleId: { in: articleIds }
        }
      })
    },
    select: {
      id: true,
      number: true,
      content: true,
      paragraph: {
        select: {
          id: true,
          number: true,
          article: {
            select: {
              id: true,
              title: true,
              law: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          }
        }
      }
    },
    take: 20
  });

  // 转换Item结果
  for (const item of items) {
    const cnNum = chineseNumbers[item.paragraph.number] || item.paragraph.number.toString();

    // 获取所属Paragraph的完整信息（用于前端显示所属款内容）
    const parentParagraph = await prisma.paragraph.findUnique({
      where: { id: item.paragraph.id },
      select: {
        id: true,
        number: true,
        content: true,
        order: true
      }
    });

    // 获取该Article的所有Paragraph（用于前端显示所有款）
    const allParagraphs = await prisma.paragraph.findMany({
      where: { articleId: item.paragraph.article.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        number: true,
        content: true,
        order: true,
        items: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            number: true,
            content: true,
            order: true
          }
        }
      }
    });

    results.push({
      id: `item-${item.id}`,
      level: 'item',
      lawTitle: item.paragraph.article.law.title,
      lawId: item.paragraph.article.law.id,
      articleTitle: item.paragraph.article.title,
      articleId: item.paragraph.article.id,
      paragraphId: item.paragraph.id,
      itemId: item.id,
      content: item.content,
      displayText: `第${item.paragraph.article.title}条第${cnNum}款第${item.number}项`, // 添加"第"和"条"字
      breadcrumb: `${item.paragraph.article.law.title} > 第${item.paragraph.article.title}条 > 第${cnNum}款 > 第${item.number}项`,
      // 附加所属Paragraph和所有Paragraph数据，用于前端显示
      parentParagraph: parentParagraph,
      allParagraphs: allParagraphs
    });
  }

  return results;
}

// ============ 违法行为关联相关函数 ============

// 获取所有法规的违法行为统计
export async function getLawsWithViolationStats() {
  const laws = await prisma.law.findMany({
    select: {
      id: true,
      title: true,
      level: true,
      status: true,
      _count: {
        select: {
          violationBasisViolations: true,
          punishmentBasisViolations: true,
        }
      }
    },
    orderBy: {
      title: 'asc'
    }
  });

  // 计算状态和统计数据
  return laws.map(law => {
    const violationBasisCount = law._count.violationBasisViolations;
    const punishmentBasisCount = law._count.punishmentBasisViolations;

    let status: 'complete' | 'partial' | 'empty';
    if (violationBasisCount > 0 && punishmentBasisCount > 0) {
      status = 'complete';
    } else if (violationBasisCount > 0 || punishmentBasisCount > 0) {
      status = 'partial';
    } else {
      status = 'empty';
    }

    return {
      id: law.id,
      title: law.title,
      level: law.level,
      status: law.status,
      violationBasisCount,
      punishmentBasisCount,
      statusType: status
    };
  }).sort((a, b) => {
    // 按总违法行为数量降序排序
    const totalA = a.violationBasisCount + a.punishmentBasisCount;
    const totalB = b.violationBasisCount + b.punishmentBasisCount;
    return totalB - totalA;
  });
}

// 获取某个法规下的所有违法行为
export async function getLawViolations(lawId: number) {
  const articleInclude = {
    select: {
      title: true,
      paragraphs: {
        orderBy: { order: 'asc' as const },
        select: {
          number: true,
          content: true,
          items: {
            orderBy: { order: 'asc' as const },
            select: { number: true, content: true }
          }
        }
      }
    }
  };

  const violations = await prisma.violation.findMany({
    where: {
      OR: [
        { violationBasisLawId: lawId },
        { punishmentBasisLawId: lawId }
      ]
    },
    select: {
      id: true,
      code: true,
      description: true,
      violationBasisLawId: true,
      violationBasisArticleId: true,
      violationBasisParagraphId: true,
      violationBasisItemId: true,
      violationBasisArticle: articleInclude,
      violationBasisParagraph: { select: { number: true, content: true } },
      violationBasisItem: { select: { number: true, content: true } },
      punishmentBasisLawId: true,
      punishmentBasisArticleId: true,
      punishmentBasisParagraphId: true,
      punishmentBasisItemId: true,
      punishmentBasisArticle: articleInclude,
      punishmentBasisParagraph: { select: { number: true, content: true } },
      punishmentBasisItem: { select: { number: true, content: true } },
    },
    orderBy: {
      code: 'asc'
    }
  });

  // 格式化条款引用文字（如 "第三条第二款"）
  const formatRef = (article: any, paragraph: any, item: any) => {
    if (!article) return '';
    let text = `第${article.title}条`;
    if (paragraph) text += `第${paragraph.number}款`;
    if (item) text += `第${item.number}项`;
    return text;
  };

  // 获取条款的具体内容
  const getArticleContent = (article: any, paragraph: any, item: any) => {
    if (!article) return '';
    // 如果指定了具体的项，返回项内容
    if (item) return item.content || '';
    // 如果指定了具体的款，返回款内容
    if (paragraph) return paragraph.content || '';
    // 否则返回整条的内容（拼接所有款和项）
    if (!article.paragraphs?.length) return '';
    return article.paragraphs.map((p: any) => {
      let text = p.content || '';
      if (p.items?.length) {
        text += '\n' + p.items.map((i: any) => `${i.number} ${i.content}`).join('\n');
      }
      return text;
    }).filter(Boolean).join('\n');
  };

  // 分组：旧格式（兼容默认详情页）
  const violationBasisList = violations.filter(v => v.violationBasisLawId === lawId);
  const punishmentBasisList = violations.filter(v => v.punishmentBasisLawId === lawId);

  const formatBasis = (violation: any) => {
    const article = violation.violationBasisArticle || violation.punishmentBasisArticle;
    const paragraph = violation.violationBasisParagraph || violation.punishmentBasisParagraph;
    const item = violation.violationBasisItem || violation.punishmentBasisItem;
    return formatRef(article, paragraph, item);
  };

  // 新格式：以违法行为为主体，去重合并
  const seen = new Set<number>();
  const merged = violations.filter(v => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  }).map(v => ({
    id: v.id,
    code: v.code,
    description: v.description,
    violationBasis: v.violationBasisArticle ? {
      ref: formatRef(v.violationBasisArticle, v.violationBasisParagraph, v.violationBasisItem),
      content: getArticleContent(v.violationBasisArticle, v.violationBasisParagraph, v.violationBasisItem),
    } : null,
    punishmentBasis: v.punishmentBasisArticle ? {
      ref: formatRef(v.punishmentBasisArticle, v.punishmentBasisParagraph, v.punishmentBasisItem),
      content: getArticleContent(v.punishmentBasisArticle, v.punishmentBasisParagraph, v.punishmentBasisItem),
    } : null,
  }));

  return {
    // 旧格式，兼容默认详情页
    violationBasis: violationBasisList.map(v => ({
      id: v.id, code: v.code, description: v.description,
      basisText: formatBasis(v)
    })),
    punishmentBasis: punishmentBasisList.map(v => ({
      id: v.id, code: v.code, description: v.description,
      basisText: formatBasis(v)
    })),
    // 新格式，原型页使用
    merged,
  };
}
