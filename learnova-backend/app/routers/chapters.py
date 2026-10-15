from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/chapters", tags=["chapters"])


@router.get("/subject/{subject_id}", response_model=List[schemas.ChapterOut])
def list_chapters(subject_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Chapter)
        .filter(models.Chapter.subject_id == subject_id)
        .order_by(models.Chapter.order_index)
        .all()
    )


@router.post("", response_model=schemas.ChapterOut, status_code=201)
def create_chapter(data: schemas.ChapterCreate, db: Session = Depends(get_db)):
    ch = models.Chapter(**data.model_dump())
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return ch


@router.get("/{chapter_id}", response_model=schemas.ChapterOut)
def get_chapter(chapter_id: int, db: Session = Depends(get_db)):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return ch


@router.put("/{chapter_id}", response_model=schemas.ChapterOut)
def update_chapter(chapter_id: int, data: schemas.ChapterUpdate, db: Session = Depends(get_db)):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(ch, field, val)
    ch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ch)
    return ch


@router.delete("/{chapter_id}", status_code=204)
def delete_chapter(chapter_id: int, db: Session = Depends(get_db)):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    db.delete(ch)
    db.commit()


@router.post("/reorder", status_code=200)
def reorder_chapters(orders: List[dict], db: Session = Depends(get_db)):
    """Accepts [{id: int, order_index: int}, ...]"""
    for item in orders:
        ch = db.query(models.Chapter).filter(models.Chapter.id == item["id"]).first()
        if ch:
            ch.order_index = item["order_index"]
    db.commit()
    return {"ok": True}
