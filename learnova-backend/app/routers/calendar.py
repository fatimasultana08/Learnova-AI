from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/events", tags=["calendar"])


@router.get("", response_model=List[schemas.CalendarEventOut])
def list_events(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.CalendarEvent)
    if start:
        q = q.filter(models.CalendarEvent.start_date >= start)
    if end:
        q = q.filter(models.CalendarEvent.start_date <= end)
    return q.order_by(models.CalendarEvent.start_date).all()


@router.post("", response_model=schemas.CalendarEventOut, status_code=201)
def create_event(data: schemas.CalendarEventCreate, db: Session = Depends(get_db)):
    event = models.CalendarEvent(**data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=schemas.CalendarEventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.CalendarEvent).filter(models.CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/{event_id}", response_model=schemas.CalendarEventOut)
def update_event(event_id: int, data: schemas.CalendarEventUpdate, db: Session = Depends(get_db)):
    event = db.query(models.CalendarEvent).filter(models.CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(event, field, val)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.CalendarEvent).filter(models.CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
